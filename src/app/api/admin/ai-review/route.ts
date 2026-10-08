import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { aiPublicStatus } from "@/lib/ai/adapter";
import { beginJob, canStart, cancelJob, currentJob, finishJob } from "@/lib/ai/jobs";
import { runAiReview } from "@/lib/ai/review";
import { ingestProposals } from "@/lib/workflows/engine";
import { seedProposals } from "@/lib/workflows/seeds";
import { loadWorkflowState, originalFingerprintFromPreview, saveWorkflowState, workflowFilePersistAllowed } from "@/lib/workflows/serverStore";
import { previewMeta } from "@/lib/workflows/previewMeta";
import { loadManual } from "@/lib/manual";
import { filterProposal } from "@/lib/workflows/validate";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  const meta = await previewMeta();
  const state = await loadWorkflowState(originalFingerprintFromPreview(meta.label, meta.pages), meta.label);
  const ai = aiPublicStatus();
  return NextResponse.json({
    job: currentJob(),
    ai: { configured: ai.configured, modelNamed: Boolean(ai.model) },
    proposals: state.proposals,
    workflows: state.workflows,
    staleOriginal: state.staleOriginal,
    originalLabel: state.originalLabel,
    persistNote: workflowFilePersistAllowed()
      ? "로컬 파일 · 운영 DB 아님"
      : "저장 미지원 · 배포에서는 연결 후보를 저장하지 않습니다.",
  });
}

export async function POST(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action === "cancel") {
    const r = cancelJob();
    if (!r.ok) return NextResponse.json({ error: r.error, saved: false }, { status: 400 });
    return NextResponse.json({ ok: true, job: currentJob() });
  }
  if (body.action !== "run") return NextResponse.json({ error: "action=run 또는 cancel" }, { status: 400 });
  const gateRun = canStart();
  if (!gateRun.ok) return NextResponse.json({ error: gateRun.error, saved: false }, { status: 429 });
  const ai = aiPublicStatus();
  const { signal } = beginJob(ai.configured);
  const meta = await previewMeta();
  let state = await loadWorkflowState(originalFingerprintFromPreview(meta.label, meta.pages), meta.label);
  const manual = await loadManual();
  try {
    if (!ai.configured) {
      const samples = seedProposals().map((p) => ({
        ...p,
        sample: true,
        reason: `시연용 예시 · ${p.reason}`,
      }));
      const ingested = ingestProposals(state, samples.map((p) => filterProposal(p, manual.indicators) || p).filter(Boolean));
      state = ingested.state;
      if (!workflowFilePersistAllowed()) {
        finishJob({ status: "done", message: "AI 미연결 · 배포에서는 후보를 저장하지 않습니다. 시연을 사용하세요.", aiConnected: false });
        return NextResponse.json({
          ok: false,
          demo: true,
          aiConnected: false,
          saved: false,
          persist: "blocked",
          persistNote: "저장 미지원 · 서버에 쓰지 않았습니다. 시연은 메모리만 사용하세요.",
          job: currentJob(),
          error: "배포 환경에서는 연결 후보를 저장하지 않습니다.",
        }, { status: 409 });
      }
      await saveWorkflowState(state);
      finishJob({ status: "done", message: `AI 미연결 · 시연용 예시 ${ingested.added}건(중복 ${ingested.skipped})`, aiConnected: false });
      return NextResponse.json({
        ok: true,
        demo: true,
        aiConnected: false,
        added: ingested.added,
        skipped: ingested.skipped,
        job: currentJob(),
        proposals: state.proposals,
        saved: true,
        persistNote: "로컬 파일 · 운영 DB 아님 · 실제 AI 분석이 아닙니다.",
      });
    }
    const ran = await runAiReview(manual.indicators, state, signal, { label: meta.label, pages: meta.pages });
    if (currentJob().status === "cancelling") {
      finishJob({ status: "failed", message: "취소되었습니다.", aiConnected: true });
      return NextResponse.json({ error: "취소되었습니다.", job: currentJob(), saved: false }, { status: 499 });
    }
    const ingested = ingestProposals(state, ran.proposals);
    state = ingested.state;
    if (!workflowFilePersistAllowed()) {
      finishJob({ status: "done", message: "AI 결과는 배포에 저장하지 않습니다.", aiConnected: ran.connected });
      return NextResponse.json({
        error: "배포 환경에서는 연결 후보를 저장하지 않습니다.",
        saved: false,
        persist: "blocked",
        persistNote: "저장 미지원 · 서버에 쓰지 않았습니다.",
        job: currentJob(),
      }, { status: 409 });
    }
    const persist = await saveWorkflowState(state);
    finishJob({
      status: ran.message.includes("AI 검토 완료") ? "done" : "failed",
      message: `${ran.message} · 추가 ${ingested.added} · 중복 ${ingested.skipped}`,
      aiConnected: ran.connected,
      usage: ran.usage,
    });
    return NextResponse.json({
      ok: true,
      demo: false,
      aiConnected: ran.connected,
      added: ingested.added,
      skipped: ingested.skipped,
      coverage: ran.coverage,
      job: currentJob(),
      proposals: state.proposals,
      saved: persist.persisted === "file",
      persistNote: persist.persisted === "file" ? "로컬 파일 · 운영 DB 아님" : persist.error || "메모리만",
    });
  } catch (e) {
    finishJob({ status: "failed", message: e instanceof Error ? e.message : "실패", aiConnected: ai.configured });
    return NextResponse.json({ error: currentJob().message, job: currentJob(), saved: false }, { status: 500 });
  }
}

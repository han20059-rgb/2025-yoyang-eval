import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { applyProposal, excludeProposal, holdProposal, restoreWorkflow } from "@/lib/workflows/engine";
import { loadWorkflowState, originalFingerprintFromPreview, saveWorkflowState, workflowFilePersistAllowed } from "@/lib/workflows/serverStore";
import { previewMeta } from "@/lib/workflows/previewMeta";

export const runtime = "nodejs";

async function stateNow() {
  const meta = await previewMeta();
  return loadWorkflowState(originalFingerprintFromPreview(meta.label, meta.pages), meta.label);
}

export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  const state = await stateNow();
  const persistOk = workflowFilePersistAllowed();
  return NextResponse.json({
    workflows: state.workflows,
    proposals: state.proposals,
    holdNotes: state.holdNotes,
    excludeNotes: state.excludeNotes,
    staleOriginal: state.staleOriginal,
    originalLabel: state.originalLabel,
    storage: persistOk ? "local-file" : "blocked",
    persistNote: persistOk
      ? "로컬 파일입니다. 운영 DB에 쓰지 않습니다."
      : "저장 미지원 · 배포 환경에서는 연결 업무를 저장하지 않습니다. 시연은 메모리만 사용하세요.",
  });
}

export async function POST(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  if (!workflowFilePersistAllowed()) {
    return NextResponse.json(
      {
        error: "배포 환경에서는 연결 업무를 저장하지 않습니다. 시연 모드를 사용하세요.",
        saved: false,
        persist: "blocked",
        persistNote: "저장 미지원 · 서버에 쓰지 않았습니다.",
      },
      { status: 409 }
    );
  }
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    proposalId?: string;
    workflowId?: string;
    historyId?: string;
    reason?: string;
    patch?: Record<string, unknown>;
  };
  let state = await stateNow();
  const actor = gate.identity.name;
  let result: { state: typeof state; error?: string } = { state };
  if (body.action === "apply") result = applyProposal(state, String(body.proposalId || ""), actor, body.patch, body.reason || "");
  else if (body.action === "hold") result = holdProposal(state, String(body.proposalId || ""), actor, String(body.reason || ""));
  else if (body.action === "exclude") result = excludeProposal(state, String(body.proposalId || ""), actor, String(body.reason || ""));
  else if (body.action === "restore") result = restoreWorkflow(state, String(body.workflowId || ""), String(body.historyId || ""), actor);
  else return NextResponse.json({ error: "알 수 없는 처리입니다." }, { status: 400 });
  if (result.error) return NextResponse.json({ error: result.error, saved: false }, { status: 400 });
  const persist = await saveWorkflowState(result.state);
  return NextResponse.json({
    ok: true,
    saved: persist.persisted === "file",
    persist: persist.persisted,
    persistNote: persist.persisted === "file" ? "로컬 파일에 반영했습니다. 운영 DB가 아닙니다." : persist.error || "메모리만 반영되었습니다.",
    workflows: result.state.workflows,
    proposals: result.state.proposals,
  });
}

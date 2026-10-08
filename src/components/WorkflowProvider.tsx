"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useEvalSession } from "@/components/EvalSession";
import { adminFetch } from "@/lib/adminClient";
import { applyProposal, emptyState, excludeProposal, holdProposal, ingestProposals, restoreWorkflow } from "@/lib/workflows/engine";
import { seedProposals } from "@/lib/workflows/seeds";
import { DEMO_WORKFLOW_KEY, WORKFLOW_EVENT, type Proposal, type Workflow, type WorkflowState } from "@/lib/workflows/types";

type Ctx = {
  state: WorkflowState;
  published: Workflow[];
  persistNote: string;
  reload: () => Promise<void>;
  decide: (action: "apply" | "hold" | "exclude", proposalId: string, reason: string, patch?: Partial<Workflow>) => Promise<string>;
  restore: (workflowId: string, historyId: string) => Promise<string>;
  runReview: () => Promise<string>;
  cancelReview: () => Promise<string>;
};

const Ctx = createContext<Ctx | null>(null);

function readDemo(): WorkflowState {
  try {
    const raw = sessionStorage.getItem(DEMO_WORKFLOW_KEY);
    if (raw) return ingestProposals(JSON.parse(raw) as WorkflowState, seedProposals()).state;
  } catch {
    /* ignore */
  }
  return ingestProposals(emptyState("demo", "시연"), seedProposals()).state;
}

function writeDemo(state: WorkflowState) {
  sessionStorage.setItem(DEMO_WORKFLOW_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(WORKFLOW_EVENT));
}

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const { mode, identity } = useEvalSession();
  const [state, setState] = useState<WorkflowState>(emptyState());
  const [persistNote, setPersistNote] = useState("");

  const reload = useCallback(async () => {
    if (mode === "demo" || (typeof window !== "undefined" && sessionStorage.getItem("eval-demo") === "1")) {
      setState(readDemo());
      setPersistNote("시연 · 메모리만 · 실제 저장 없음");
      return;
    }
    const url = identity?.isAdmin ? "/api/admin/workflows" : "/api/workflows";
    const res = await fetch(url, { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPersistNote(data.error || "연결 업무를 읽지 못했습니다.");
      return;
    }
    if (identity?.isAdmin) {
      setState({
        originalFingerprint: "",
        originalLabel: data.originalLabel || "",
        staleOriginal: Boolean(data.staleOriginal),
        workflows: data.workflows || [],
        proposals: data.proposals || [],
        jobs: [],
        holdNotes: data.holdNotes || [],
        excludeNotes: data.excludeNotes || [],
      });
    } else {
      setState({
        ...emptyState(),
        workflows: data.items || [],
        originalLabel: data.originalLabel || "",
        staleOriginal: Boolean(data.staleOriginal),
      });
    }
    setPersistNote(data.persistNote || data.note || "");
  }, [mode, identity?.isAdmin]);

  useEffect(() => {
    void reload();
    const on = () => {
      if (sessionStorage.getItem("eval-demo") === "1") setState(readDemo());
    };
    window.addEventListener(WORKFLOW_EVENT, on);
    return () => window.removeEventListener(WORKFLOW_EVENT, on);
  }, [reload]);

  const decide = useCallback(
    async (action: "apply" | "hold" | "exclude", proposalId: string, reason: string, patch?: Partial<Workflow>) => {
      if (mode === "demo") {
        const cur = readDemo();
        const r =
          action === "apply"
            ? applyProposal(cur, proposalId, identity?.name || "시연", patch, reason)
            : action === "hold"
              ? holdProposal(cur, proposalId, identity?.name || "시연", reason)
              : excludeProposal(cur, proposalId, identity?.name || "시연", reason);
        if (r.error) return r.error;
        writeDemo(r.state);
        setState(r.state);
        return "시연 반영 · 실제 저장 없음";
      }
      const res = await adminFetch("/api/admin/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, proposalId, reason, patch }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error || "처리 실패";
      setState((s) => ({ ...s, workflows: data.workflows || s.workflows, proposals: data.proposals || s.proposals }));
      setPersistNote(data.persistNote || "");
      return data.saved ? data.persistNote : data.persistNote || "영구 저장 전";
    },
    [mode, identity?.name]
  );

  const restore = useCallback(
    async (workflowId: string, historyId: string) => {
      if (mode === "demo") {
        const r = restoreWorkflow(readDemo(), workflowId, historyId, identity?.name || "시연");
        if (r.error) return r.error;
        writeDemo(r.state);
        setState(r.state);
        return "시연 복원 · 실제 저장 없음";
      }
      const res = await adminFetch("/api/admin/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", workflowId, historyId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error || "복원 실패";
      setState((s) => ({ ...s, workflows: data.workflows || s.workflows }));
      return data.persistNote || "복원";
    },
    [mode, identity?.name]
  );

  const runReview = useCallback(async () => {
    if (mode === "demo") {
      const cur = readDemo();
      const samples = seedProposals().map((p) => ({ ...p, sample: true, reason: `시연용 예시 · ${p.reason}` }));
      const r = ingestProposals(cur, samples);
      writeDemo(r.state);
      setState(r.state);
      return `AI 미연결 · 시연용 예시 추가 ${r.added} · 중복 ${r.skipped} · 실제 AI 분석이 아닙니다.`;
    }
    const res = await adminFetch("/api/admin/ai-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "run" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error || "검토 실패";
    setState((s) => ({ ...s, proposals: data.proposals || s.proposals }));
    return data.persistNote ? `${data.job?.message || ""} · ${data.persistNote}` : data.job?.message || "완료";
  }, [mode]);

  const cancelReview = useCallback(async () => {
    if (mode === "demo") return "시연에서는 즉시 끝나 취소할 진행이 없습니다.";
    const res = await adminFetch("/api/admin/ai-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const data = await res.json().catch(() => ({}));
    return data.error || "취소 요청";
  }, [mode]);

  const value = useMemo(
    () => ({
      state,
      published: state.workflows.filter((w) => w.status === "approved"),
      persistNote,
      reload,
      decide,
      restore,
      runReview,
      cancelReview,
    }),
    [state, persistNote, reload, decide, restore, runReview, cancelReview]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkflows() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("WorkflowProvider 필요");
  return ctx;
}

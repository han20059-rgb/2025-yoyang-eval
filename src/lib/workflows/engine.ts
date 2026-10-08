import type { HistoryEntry, Proposal, Workflow, WorkflowState } from "@/lib/workflows/types";

export function emptyState(fp = "", label = ""): WorkflowState {
  return {
    originalFingerprint: fp,
    originalLabel: label,
    staleOriginal: false,
    workflows: [],
    proposals: [],
    jobs: [],
    holdNotes: [],
    excludeNotes: [],
  };
}

export function fingerprintOf(kind: string, name: string, indicatorIds: number[], marks: string) {
  return `${kind}|${name}|${indicatorIds.join(",")}|${marks}`;
}

function hist(action: string, actor: string, reason: string, before: unknown, after: unknown): HistoryEntry {
  return {
    id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    actor,
    action,
    reason,
    before,
    after,
  };
}

export function ingestProposals(state: WorkflowState, incoming: Proposal[]): { state: WorkflowState; added: number; skipped: number } {
  const seen = new Set(state.proposals.map((p) => p.fingerprint));
  const held = new Set(state.holdNotes.map((n) => n.fingerprint));
  const excluded = new Set(state.excludeNotes.map((n) => n.fingerprint));
  const next = [...state.proposals];
  let added = 0;
  let skipped = 0;
  for (const p of incoming) {
    if (seen.has(p.fingerprint) || held.has(p.fingerprint) || excluded.has(p.fingerprint)) {
      skipped += 1;
      continue;
    }
    if (state.workflows.some((w) => w.id === p.proposed.id && w.status === "approved" && p.kind === "new")) {
      skipped += 1;
      continue;
    }
    seen.add(p.fingerprint);
    next.push({ ...p, status: "open" });
    added += 1;
  }
  return { state: { ...state, proposals: next }, added, skipped };
}

export function applyProposal(
  state: WorkflowState,
  proposalId: string,
  actor: string,
  patch?: Partial<Workflow>,
  reason = ""
): { state: WorkflowState; error?: string } {
  const p = state.proposals.find((x) => x.id === proposalId);
  if (!p || p.status !== "open") return { state, error: "적용할 열린 후보가 없습니다." };
  const proposed: Workflow = {
    ...p.proposed,
    ...patch,
    sources: patch?.sources || p.proposed.sources,
    status: "approved",
    reviewer: actor,
    reviewedAt: new Date().toISOString(),
    history: [
      ...p.proposed.history,
      hist("apply", actor, reason || p.reason, p.before || null, { ...p.proposed, ...patch, status: "approved" }),
    ],
  };
  if (!proposed.sources.some((s) => s.quote) && proposed.kind === "original") {
    return { state, error: "원문 근거가 없어 원문 직접 연결로 적용하지 않습니다." };
  }
  const rest = state.workflows.filter((w) => w.id !== proposed.id);
  const proposals = state.proposals.map((x) =>
    x.id === proposalId ? { ...x, status: "applied" as const, decidedAt: proposed.reviewedAt, decidedBy: actor, decideReason: reason } : x
  );
  return { state: { ...state, workflows: [...rest, proposed], proposals } };
}

export function holdProposal(state: WorkflowState, proposalId: string, actor: string, reason: string): { state: WorkflowState; error?: string } {
  if (!reason.trim()) return { state, error: "보류 이유를 적어야 다음 검토에 전달됩니다." };
  const p = state.proposals.find((x) => x.id === proposalId);
  if (!p || p.status !== "open") return { state, error: "보류할 열린 후보가 없습니다." };
  return {
    state: {
      ...state,
      proposals: state.proposals.map((x) =>
        x.id === proposalId ? { ...x, status: "held" as const, decideReason: reason, decidedAt: new Date().toISOString(), decidedBy: actor } : x
      ),
      holdNotes: [...state.holdNotes.filter((n) => n.fingerprint !== p.fingerprint), { fingerprint: p.fingerprint, reason }],
    },
  };
}

export function excludeProposal(state: WorkflowState, proposalId: string, actor: string, reason: string): { state: WorkflowState; error?: string } {
  if (!reason.trim()) return { state, error: "제외 이유를 적어야 다음 검토에 전달됩니다." };
  const p = state.proposals.find((x) => x.id === proposalId);
  if (!p || p.status !== "open") return { state, error: "제외할 열린 후보가 없습니다." };
  return {
    state: {
      ...state,
      proposals: state.proposals.map((x) =>
        x.id === proposalId ? { ...x, status: "excluded" as const, decideReason: reason, decidedAt: new Date().toISOString(), decidedBy: actor } : x
      ),
      excludeNotes: [...state.excludeNotes.filter((n) => n.fingerprint !== p.fingerprint), { fingerprint: p.fingerprint, reason }],
    },
  };
}

export function restoreWorkflow(state: WorkflowState, workflowId: string, historyId: string, actor: string): { state: WorkflowState; error?: string } {
  const w = state.workflows.find((x) => x.id === workflowId);
  if (!w) return { state, error: "복원할 연결 업무가 없습니다." };
  const h = w.history.find((x) => x.id === historyId);
  if (!h) return { state, error: "해당 이력이 없습니다." };
  const snapshot = (h.before || null) as Workflow | null;
  const next: Workflow = snapshot?.id
    ? {
        ...snapshot,
        reviewer: actor,
        reviewedAt: new Date().toISOString(),
        history: [...w.history, hist("restore", actor, `이력 ${historyId} 복원`, w, snapshot)],
      }
    : {
        ...w,
        status: "candidate",
        reviewer: actor,
        reviewedAt: new Date().toISOString(),
        history: [...w.history, hist("restore", actor, `이력 ${historyId} 복원 · 적용 전으로`, w, { status: "candidate" })],
      };
  return { state: { ...state, workflows: state.workflows.map((x) => (x.id === workflowId ? next : x)) } };
}

export function publishedOf(state: WorkflowState) {
  return state.workflows.filter((w) => w.status === "approved");
}

export function forIndicator(state: WorkflowState, indicatorId: number) {
  return publishedOf(state).filter((w) => w.indicatorIds.includes(indicatorId));
}

export function markRecheck(state: WorkflowState, workflowId: string, note: string): WorkflowState {
  return {
    ...state,
    workflows: state.workflows.map((w) =>
      w.id === workflowId ? { ...w, recheck: true, recheckNote: note } : w
    ),
  };
}

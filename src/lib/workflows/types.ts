export type LinkKind = "original" | "practice";

export type WorkflowStatus = "candidate" | "approved" | "held" | "excluded";

export type ProposalKind = "new" | "edit" | "error" | "gap";

export type ProposalStatus = "open" | "applied" | "held" | "excluded";

export type WorkflowStep = {
  id: string;
  order: number;
  title: string;
  work: string;
  evidence: string;
};

export type IndicatorCondition = {
  indicatorId: number;
  marks: string[];
  audience: string;
  period: string;
  deadline: string;
  confirmMethod: string;
};

export type SourceRef = {
  indicatorId: number;
  mark?: string;
  quote: string;
  filePage?: number;
  printedPage?: number;
  visualCheck?: boolean;
};

export type HistoryEntry = {
  id: string;
  at: string;
  actor: string;
  action: string;
  reason: string;
  before: unknown;
  after: unknown;
};

export type Workflow = {
  id: string;
  name: string;
  description: string;
  shortFlow: string;
  indicatorIds: number[];
  steps: WorkflowStep[];
  conditions: IndicatorCondition[];
  mustCheck: string[];
  duplicateLimits: string[];
  exceptions: string[];
  kind: LinkKind;
  sources: SourceRef[];
  originalId: string;
  originalVersion: string;
  fileHash: string;
  status: WorkflowStatus;
  reviewer?: string;
  reviewedAt?: string;
  recheck: boolean;
  recheckNote: string;
  history: HistoryEntry[];
};

export type Proposal = {
  id: string;
  fingerprint: string;
  kind: ProposalKind;
  sample: boolean;
  workflowId?: string;
  proposed: Workflow;
  before?: Workflow;
  reason: string;
  facts: string[];
  interpretations: string[];
  sources: SourceRef[];
  affectedWorkflowIds: string[];
  visualCheck: boolean;
  status: ProposalStatus;
  decideReason: string;
  decidedAt?: string;
  decidedBy?: string;
};

export type ReviewJob = {
  id: string;
  status: "idle" | "running" | "cancelling" | "done" | "failed";
  startedAt?: string;
  finishedAt?: string;
  message: string;
  aiConnected: boolean;
  usage?: { prompt?: number; completion?: number };
};

export type WorkflowState = {
  originalFingerprint: string;
  originalLabel: string;
  staleOriginal: boolean;
  workflows: Workflow[];
  proposals: Proposal[];
  jobs: ReviewJob[];
  holdNotes: { fingerprint: string; reason: string }[];
  excludeNotes: { fingerprint: string; reason: string }[];
};

export const WORKFLOW_EVENT = "yoyang-workflows";
export const DEMO_WORKFLOW_KEY = "eval-demo-workflows";

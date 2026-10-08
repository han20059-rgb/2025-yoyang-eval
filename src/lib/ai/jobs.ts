import type { ReviewJob } from "@/lib/workflows/types";

type Runner = {
  job: ReviewJob;
  abort: AbortController;
  lastStart: number;
  runs: { at: number }[];
};

const runner: Runner = {
  job: { id: "", status: "idle", message: "", aiConnected: false },
  abort: new AbortController(),
  lastStart: 0,
  runs: [],
};

const MIN_MS = 20_000;
const MAX_PER_HOUR = Number(process.env.EVAL_AI_MAX_RUNS_PER_HOUR || 6);

export function currentJob(): ReviewJob {
  return runner.job;
}

export function canStart(): { ok: boolean; error?: string } {
  if (runner.job.status === "running" || runner.job.status === "cancelling") {
    return { ok: false, error: "이미 검토가 진행 중입니다." };
  }
  const hourAgo = Date.now() - 60 * 60 * 1000;
  runner.runs = runner.runs.filter((r) => r.at > hourAgo);
  if (runner.runs.length >= MAX_PER_HOUR) {
    return { ok: false, error: `한 시간 사용량 제한(${MAX_PER_HOUR}회)입니다.` };
  }
  if (Date.now() - runner.lastStart < MIN_MS) {
    return { ok: false, error: "잠시 후 다시 실행해 주세요." };
  }
  return { ok: true };
}

export function beginJob(aiConnected: boolean): { job: ReviewJob; signal: AbortSignal } {
  runner.abort = new AbortController();
  runner.lastStart = Date.now();
  runner.runs.push({ at: runner.lastStart });
  runner.job = {
    id: `job-${runner.lastStart}`,
    status: "running",
    startedAt: new Date().toISOString(),
    message: aiConnected ? "AI 검토 중" : "시연용 예시 후보를 준비하는 중",
    aiConnected,
  };
  return { job: runner.job, signal: runner.abort.signal };
}

export function finishJob(patch: Partial<ReviewJob>) {
  runner.job = { ...runner.job, ...patch, status: patch.status || "done", finishedAt: new Date().toISOString() };
}

export function cancelJob() {
  if (runner.job.status !== "running") return { ok: false, error: "진행 중인 검토가 없습니다." };
  runner.job = { ...runner.job, status: "cancelling", message: "취소 요청" };
  runner.abort.abort();
  return { ok: true };
}

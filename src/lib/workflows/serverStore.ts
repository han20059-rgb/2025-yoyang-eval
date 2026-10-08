import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { emptyState, ingestProposals } from "@/lib/workflows/engine";
import { seedProposals } from "@/lib/workflows/seeds";
import type { WorkflowState } from "@/lib/workflows/types";

const FILE = join(process.cwd(), "data/workflows/runtime.json");

let mem: WorkflowState | null = null;
let writing = false;

export function workflowFilePersistAllowed() {
  return !process.env.VERCEL;
}

export function originalFingerprintFromPreview(label: string, pageCount: number) {
  return `${label}|${pageCount}`;
}

function withSeeds(state: WorkflowState): WorkflowState {
  return ingestProposals(state, seedProposals()).state;
}

export async function loadWorkflowState(fp: string, label: string): Promise<WorkflowState> {
  if (mem && mem.originalFingerprint === fp) return mem;
  if (!workflowFilePersistAllowed()) {
    mem = withSeeds({ ...emptyState(fp, label) });
    return mem;
  }
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as WorkflowState;
    parsed.staleOriginal = Boolean(parsed.originalFingerprint && parsed.originalFingerprint !== fp);
    parsed.originalFingerprint = parsed.originalFingerprint || fp;
    parsed.originalLabel = parsed.originalLabel || label;
    mem = withSeeds(parsed);
    return mem;
  } catch {
    mem = withSeeds({ ...emptyState(fp, label) });
    return mem;
  }
}

export async function saveWorkflowState(state: WorkflowState): Promise<{ persisted: "file" | "memory"; error?: string }> {
  mem = state;
  if (!workflowFilePersistAllowed()) {
    return { persisted: "memory", error: "배포 환경에서는 연결 업무를 저장하지 않습니다. 시연만 사용하세요." };
  }
  if (writing) return { persisted: "memory", error: "다른 저장이 진행 중입니다." };
  writing = true;
  try {
    await mkdir(join(process.cwd(), "data/workflows"), { recursive: true });
    await writeFile(FILE, JSON.stringify(state, null, 2), "utf8");
    return { persisted: "file" };
  } catch (e) {
    return { persisted: "memory", error: e instanceof Error ? e.message : "로컬 파일 저장 실패" };
  } finally {
    writing = false;
  }
}

export function memoryState() {
  return mem;
}

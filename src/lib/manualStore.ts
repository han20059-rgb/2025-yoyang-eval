import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import type { CrossFormatDiff, FileExtractResult } from "@/lib/extract/types";
import type { RevisionChange } from "@/lib/extract/compare";

export type EmptyDate = string | null;

export type ManualEdition = {
  id: string;
  evalYear: number | null;
  docKind: string;
  publishedOn: EmptyDate;
  appliedOn: EmptyDate;
  source: string;
  editionKind: "original" | "revision";
  parentId: string | null;
  evalCycleNote: string;
  status: "draft" | "reviewing" | "approved_pending_expose" | "exposed" | "rolled_back";
  exposeToStaff: boolean;
  createdAt: string;
  files: {
    pdf?: { name: string; stored: string; size: number };
    hwp?: { name: string; stored: string; size: number };
  };
  extracts: {
    pdf?: FileExtractResult;
    hwp?: FileExtractResult;
  };
  compare?: {
    compared: boolean;
    note: string;
    diffs: CrossFormatDiff[];
    cannotConfirmNoOmission: true;
  };
  revisionAgainst?: string;
  revisionChanges?: RevisionChange[];
  checkPreview?: { keep: string[]; recheck: string[]; archive: string[] };
};

type IndexFile = { editions: ManualEdition[] };

/** Local disk only. Vercel filesystem is not durable storage; use Supabase Storage in production. */
const ROOT = join(process.cwd(), "data", "manual-store");
const INDEX = join(ROOT, "index.json");

async function ensure() {
  await mkdir(join(ROOT, "files"), { recursive: true });
  await mkdir(join(ROOT, "extracts"), { recursive: true });
}

async function readIndex(): Promise<IndexFile> {
  await ensure();
  try {
    const raw = await readFile(INDEX, "utf8");
    return JSON.parse(raw) as IndexFile;
  } catch {
    return { editions: [] };
  }
}

async function writeIndex(idx: IndexFile) {
  await ensure();
  await writeFile(INDEX, JSON.stringify(idx, null, 2), "utf8");
}

function emptyToNull(v: string | null | undefined): EmptyDate {
  const s = (v || "").trim();
  return s ? s : null;
}

export async function listEditions(): Promise<ManualEdition[]> {
  const idx = await readIndex();
  return idx.editions;
}

export async function getEdition(id: string): Promise<ManualEdition | null> {
  const idx = await readIndex();
  return idx.editions.find((e) => e.id === id) || null;
}

export async function createEdition(input: {
  evalYear: string;
  docKind: string;
  publishedOn: string;
  appliedOn: string;
  source: string;
  editionKind: "original" | "revision";
  parentId: string;
  evalCycleNote: string;
}): Promise<ManualEdition> {
  const idx = await readIndex();
  const yearRaw = input.evalYear.trim();
  const edition: ManualEdition = {
    id: crypto.randomUUID(),
    evalYear: yearRaw ? Number(yearRaw) : null,
    docKind: input.docKind.trim() || "시설급여 평가매뉴얼",
    publishedOn: emptyToNull(input.publishedOn),
    appliedOn: emptyToNull(input.appliedOn),
    source: input.source.trim(),
    editionKind: input.editionKind,
    parentId: input.parentId.trim() || null,
    evalCycleNote: input.evalCycleNote.trim(),
    status: "draft",
    exposeToStaff: false,
    createdAt: new Date().toISOString(),
    files: {},
    extracts: {},
  };
  idx.editions.unshift(edition);
  await writeIndex(idx);
  return edition;
}

export async function saveFile(id: string, kind: "pdf" | "hwp", name: string, buf: Buffer) {
  const idx = await readIndex();
  const edition = idx.editions.find((e) => e.id === id);
  if (!edition) throw new Error("등록본을 찾지 못했습니다.");
  const stored = `${id}-${kind}-${Date.now()}-${name.replace(/[^\w.\-가-힣]/g, "_")}`;
  await writeFile(join(ROOT, "files", stored), buf);
  edition.files[kind] = { name, stored, size: buf.length };
  edition.status = "draft";
  edition.exposeToStaff = false;
  await writeIndex(idx);
  return edition;
}

export async function readStoredFile(stored: string) {
  return readFile(join(ROOT, "files", stored));
}

export async function saveExtracts(
  id: string,
  extracts: ManualEdition["extracts"],
  compare: ManualEdition["compare"]
) {
  const idx = await readIndex();
  const edition = idx.editions.find((e) => e.id === id);
  if (!edition) throw new Error("등록본을 찾지 못했습니다.");
  await writeFile(join(ROOT, "extracts", `${id}.json`), JSON.stringify({ extracts, compare }, null, 2), "utf8");
  edition.extracts = {
    pdf: extracts.pdf ? slimExtract(extracts.pdf) : undefined,
    hwp: extracts.hwp ? slimExtract(extracts.hwp) : undefined,
  };
  edition.compare = compare;
  edition.status = "reviewing";
  await writeIndex(idx);
  return edition;
}

function slimExtract(ex: FileExtractResult): FileExtractResult {
  return {
    ...ex,
    pages: ex.pages.map((p) => ({
      ...p,
      text: p.text.slice(0, 800),
      left: p.left.slice(0, 200),
      right: p.right.slice(0, 200),
    })),
    blocks: ex.blocks.slice(0, 20),
  };
}

export async function readFullExtracts(id: string) {
  const raw = await readFile(join(ROOT, "extracts", `${id}.json`), "utf8");
  return JSON.parse(raw) as { extracts: ManualEdition["extracts"]; compare: ManualEdition["compare"] };
}

export async function saveRevisionPreview(
  id: string,
  against: string,
  changes: RevisionChange[],
  checkPreview: ManualEdition["checkPreview"]
) {
  const idx = await readIndex();
  const edition = idx.editions.find((e) => e.id === id);
  if (!edition) throw new Error("등록본을 찾지 못했습니다.");
  edition.revisionAgainst = against;
  edition.revisionChanges = changes;
  edition.checkPreview = checkPreview;
  await writeIndex(idx);
  return edition;
}

export async function setStatus(id: string, status: ManualEdition["status"], exposeToStaff: boolean) {
  const idx = await readIndex();
  const edition = idx.editions.find((e) => e.id === id);
  if (!edition) throw new Error("등록본을 찾지 못했습니다.");
  edition.status = status;
  edition.exposeToStaff = exposeToStaff;
  await writeIndex(idx);
  return edition;
}

export function staffManualMustStayBundled(edition: ManualEdition) {
  return !edition.exposeToStaff || edition.status !== "exposed";
}

export async function saveCheckArchive(id: string, archive: { at: string; checks: Record<string, boolean>; recheck: string[]; keep: string[] }) {
  const idx = await readIndex();
  const edition = idx.editions.find((e) => e.id === id);
  if (!edition) throw new Error("등록본을 찾지 못했습니다.");
  const path = join(ROOT, "extracts", `${id}-check-archive.json`);
  await writeFile(path, JSON.stringify(archive, null, 2), "utf8");
  return path;
}

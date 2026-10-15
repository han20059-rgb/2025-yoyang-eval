import { readFile } from "fs/promises";
import { join } from "path";
import type { IndicatorFull, IndicatorSection } from "./parseIndicators";

export type ConfirmedAbsence = {
  pdfFile: string;
  pdfSha12: string;
  indicatorId: number;
  sectionId: keyof IndicatorFull["sections"];
  filePages: number[];
  kind: "section-absent-in-original";
  evidence: string;
};

export type ConfirmedAbsenceFile = {
  note: string;
  records: ConfirmedAbsence[];
};

export type AbsenceApplyResult = {
  applied: number;
  skippedWrongSha: number;
  skippedHasText: number;
  skippedPages: number;
  skippedMissing: number;
};

function pagesOverlap(a: number[], b: number[]) {
  if (!a.length || !b.length) return false;
  const set = new Set(a);
  return b.some((n) => set.has(n));
}

function sectionEmpty(sec: IndicatorSection) {
  return !sec.text.trim();
}

export function applyConfirmedAbsences(
  indicators: IndicatorFull[],
  records: ConfirmedAbsence[],
  pdfSha12: string
): AbsenceApplyResult {
  const result: AbsenceApplyResult = {
    applied: 0,
    skippedWrongSha: 0,
    skippedHasText: 0,
    skippedPages: 0,
    skippedMissing: 0,
  };
  const byId = new Map(indicators.map((ind) => [ind.id, ind]));
  for (const rec of records) {
    if (rec.pdfSha12 !== pdfSha12) {
      result.skippedWrongSha += 1;
      continue;
    }
    const ind = byId.get(rec.indicatorId);
    const sec = ind?.sections[rec.sectionId];
    if (!ind || !sec) {
      result.skippedMissing += 1;
      continue;
    }
    if (!sectionEmpty(sec)) {
      result.skippedHasText += 1;
      continue;
    }
    if (!pagesOverlap(ind.filePages, rec.filePages)) {
      result.skippedPages += 1;
      continue;
    }
    if (!sec.needsReview) continue;
    sec.needsReview = false;
    sec.reviewReason = rec.evidence;
    result.applied += 1;
  }
  return result;
}

export async function loadConfirmedAbsences(root = process.cwd()): Promise<ConfirmedAbsenceFile> {
  const raw = await readFile(join(root, "src", "data", "confirmed-absences.json"), "utf8");
  return JSON.parse(raw) as ConfirmedAbsenceFile;
}

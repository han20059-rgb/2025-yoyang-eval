import type { CrossFormatDiff, FileExtractResult } from "@/lib/extract/types";

function norm(s: string) {
  return s.replace(/\s+/g, " ").replace(/[·ㆍ･]/g, "·").trim();
}

function tokens(s: string) {
  return norm(s)
    .split(/[^\p{L}\p{N}①-⑮]+/u)
    .filter((t) => t.length > 1);
}

export function similarity(a: string, b: string) {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let hit = 0;
  for (const t of A) if (B.has(t)) hit += 1;
  return (2 * hit) / (A.size + B.size);
}

export function compareExtracts(pdf: FileExtractResult | null, hwp: FileExtractResult | null): {
  compared: boolean;
  note: string;
  diffs: CrossFormatDiff[];
  cannotConfirmNoOmission: true;
} {
  if (!pdf || !hwp) {
    return {
      compared: false,
      note: "다른 형식과 대조하지 않음. 파일이 둘인 것과 배포본이 다른 것은 구분합니다. 같은 배포본 여부는 미확정입니다.",
      diffs: [],
      cannotConfirmNoOmission: true,
    };
  }
  const pdfText = pdf.pages.map((p) => p.text).join("\n");
  const hwpText = hwp.pages.map((p) => p.text).join("\n");
  const diffs: CrossFormatDiff[] = [];
  const pdfMarks = pdfText.match(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮]/g) || [];
  const hwpMarks = hwpText.match(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮]/g) || [];
  if (pdfMarks.length !== hwpMarks.length) {
    diffs.push({
      page: null,
      kind: "text-mismatch",
      pdfText: `자동번호 ${pdfMarks.length}개`,
      hwpText: `자동번호 ${hwpMarks.length}개`,
      note: "자동 번호 개수가 다릅니다.",
    });
  }
  const overall = similarity(pdfText, hwpText);
  if (overall < 0.35) {
    diffs.push({
      page: null,
      kind: "text-mismatch",
      pdfText: pdfText.slice(0, 500),
      hwpText: hwpText.slice(0, 500),
      note: "추출 품질을 먼저 보세요. 이 점수만으로 다른 배포본이라고 단정하지 않습니다.",
    });
  }
  if (pdf.tables.length !== hwp.tables.length) {
    diffs.push({
      page: null,
      kind: "table-mismatch",
      pdfText: `표 ${pdf.tables.length}개`,
      hwpText: `표 ${hwp.tables.length}개`,
      note: "표 개수가 다릅니다.",
    });
  }
  return {
    compared: true,
    note: `파일은 PDF와 HWP로 따로 보존합니다. 전체 유사도 ${overall.toFixed(2)}. 같은 배포본 여부는 미확정입니다. 추출이 부정확하면 배포본 차이로 보지 않습니다.`,
    diffs,
    cannotConfirmNoOmission: true,
  };
}

export type CriterionSnap = {
  indicatorHint: string;
  mark: string;
  text: string;
  score: string;
  period: string;
  frequency: string;
  deadline: string;
};

export function extractCriterionSnaps(text: string): CriterionSnap[] {
  const chunks = text.split(/(?=평가지표\s*\d+)/);
  const out: CriterionSnap[] = [];
  for (const chunk of chunks) {
    const id = chunk.match(/평가지표\s*(\d+)/)?.[1] || "";
    const period = chunk.match(/지표적용기간[^\n]*/)?.[0] || "";
    const score = chunk.match(/(?:기준\s*점수|채점기준)[\s\S]{0,400}/)?.[0] || "";
    const marks = chunk.split(/(?=[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮])/);
    for (const part of marks) {
      const m = part.match(/^([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮])\s*([\s\S]+)/);
      if (!m) continue;
      const body = m[2].trim();
      if (body.length < 8) continue;
      out.push({
        indicatorHint: id,
        mark: m[1],
        text: body.slice(0, 500),
        score,
        period,
        frequency: (body.match(/(연\s*\d+\s*회|반기별|분기별|매월)/) || [""])[0],
        deadline: (body.match(/([^\n]*(이내|까지|공고월)[^\n]*)/) || [""])[0],
      });
    }
  }
  return out;
}

export type RevisionChange = {
  type: "added" | "removed" | "changed" | "score" | "period" | "frequency" | "deadline";
  left?: CriterionSnap;
  right?: CriterionSnap;
  note: string;
};

export function compareRevisions(prevText: string, nextText: string): RevisionChange[] {
  const prev = extractCriterionSnaps(prevText);
  const next = extractCriterionSnaps(nextText);
  const used = new Set<number>();
  const changes: RevisionChange[] = [];
  for (const a of prev) {
    let best = -1;
    let bestI = -1;
    next.forEach((b, i) => {
      if (used.has(i)) return;
      const s = similarity(a.text, b.text) + (a.indicatorHint === b.indicatorHint ? 0.1 : 0);
      if (s > best) {
        best = s;
        bestI = i;
      }
    });
    if (bestI < 0 || best < 0.42) {
      changes.push({ type: "removed", left: a, note: "내용 기준으로 대응되는 다음 판 항목을 찾지 못했습니다." });
      continue;
    }
    used.add(bestI);
    const b = next[bestI];
    if (similarity(a.text, b.text) < 0.92) {
      changes.push({ type: "changed", left: a, right: b, note: "기준 문구가 달라 보입니다. 번호만으로 연결하지 않았습니다." });
    }
    if (norm(a.score) && norm(b.score) && norm(a.score) !== norm(b.score)) {
      changes.push({ type: "score", left: a, right: b, note: "배점·채점 문구가 달라 보입니다." });
    }
    if (norm(a.period) && norm(b.period) && norm(a.period) !== norm(b.period)) {
      changes.push({ type: "period", left: a, right: b, note: "적용기간이 달라 보입니다." });
    }
    if (norm(a.frequency) !== norm(b.frequency) && (a.frequency || b.frequency)) {
      changes.push({ type: "frequency", left: a, right: b, note: "주기·횟수가 달라 보입니다." });
    }
    if (norm(a.deadline) !== norm(b.deadline) && (a.deadline || b.deadline)) {
      changes.push({ type: "deadline", left: a, right: b, note: "기한이 달라 보입니다." });
    }
  }
  next.forEach((b, i) => {
    if (!used.has(i)) changes.push({ type: "added", right: b, note: "이전 판에서 대응 항목을 찾지 못한 추가 후보입니다." });
  });
  return changes;
}

export function previewCheckUpdates(
  changes: RevisionChange[],
  currentKeys: string[]
): { keep: string[]; recheck: string[]; archive: string[] } {
  const keep: string[] = [];
  const recheck: string[] = [];
  const archive: string[] = [];
  const changedMarks = new Set(
    changes
      .filter((c) => c.type === "changed" || c.type === "score" || c.type === "period" || c.type === "frequency" || c.type === "deadline")
      .map((c) => `${c.left?.indicatorHint || ""}:${c.left?.mark || ""}`)
  );
  const removedMarks = new Set(changes.filter((c) => c.type === "removed").map((c) => `${c.left?.indicatorHint || ""}:${c.left?.mark || ""}`));
  for (const key of currentKeys) {
    const [, id, mark] = key.match(/^(\d+):([^:]+):/) || [];
    const sig = `${id || ""}:${mark || ""}`;
    if (removedMarks.has(sig)) archive.push(key);
    else if (changedMarks.has(sig)) recheck.push(key);
    else keep.push(key);
  }
  return { keep, recheck, archive };
}

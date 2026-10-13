import type { Indicator } from "@/lib/types";

export type SharedPage = { page: number; thisId: number; nextId: number };

export type IndicatorPdfRange = {
  indicatorId: number;
  from: number;
  to: number;
  pages: number[];
  nextIndicatorId: number | null;
  sharedWithNext: SharedPage | null;
  lastIndicator: boolean;
  endBoundary?: { page: number; nextStarts: string; evidence: string };
};

/** Official 205-page PDF: last scored indicator is 45 on file page 173. */
export const LAST_INDICATOR_END = {
  page: 173,
  nextStarts: "파일 174쪽 ‘1) 평가방향’ · 청구상담봉사자 별도 자료. 이어서 175쪽 【별표2】 평가조사표.",
  evidence:
    "등록 원본 official/2025-eval-manual.pdf(sha12 1e515ac43a8e) 174쪽은 평가지표가 아니라 청구상담봉사자 지원 안내로 시작하고, 175쪽은 【별표2】 평가조사표다.",
};

function startPage(ind: Indicator) {
  const pages = ind.fullSource?.filePages?.length ? ind.fullSource.filePages : ind.pages;
  return [...(pages || [])].filter((n) => n > 0).sort((a, b) => a - b)[0] || 0;
}

export function pdfRangeFor(indicator: Indicator, catalog: Indicator[]): IndicatorPdfRange {
  const pages = [...(indicator.fullSource?.filePages?.length ? indicator.fullSource.filePages : indicator.pages || [])]
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  const starts = catalog
    .map((c) => ({ id: c.id, from: startPage(c) }))
    .filter((s) => s.from > 0)
    .sort((a, b) => a.from - b.from || a.id - b.id);
  const idx = starts.findIndex((s) => s.id === indicator.id);
  const nxt = idx >= 0 ? starts[idx + 1] : undefined;
  const from = pages[0] || starts[idx]?.from || 1;
  let to = from;
  let sharedWithNext: SharedPage | null = null;
  if (nxt) {
    if (nxt.from === from) {
      to = from;
      sharedWithNext = { page: from, thisId: indicator.id, nextId: nxt.id };
    } else {
      to = nxt.from - 1;
    }
  } else {
    to = LAST_INDICATOR_END.page;
  }
  const span = Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
  const lastIndicator = !nxt;
  return {
    indicatorId: indicator.id,
    from,
    to,
    pages: span,
    nextIndicatorId: nxt?.id ?? null,
    sharedWithNext,
    lastIndicator,
    endBoundary: lastIndicator ? { ...LAST_INDICATOR_END } : undefined,
  };
}

export function originalRangeHref(indicator: Indicator, catalog: Indicator[]) {
  const r = pdfRangeFor(indicator, catalog);
  const q = new URLSearchParams({
    indicator: String(indicator.id),
    from: String(r.from),
    to: String(r.to),
  });
  return `/preview/original-pdf?${q.toString()}`;
}

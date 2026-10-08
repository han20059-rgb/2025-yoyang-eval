import type { Proposal, SourceRef } from "@/lib/workflows/types";
import type { Indicator } from "@/lib/types";

export function sourceAllowed(src: SourceRef, indicators: Indicator[]): { ok: boolean; visualCheck?: boolean; reason?: string } {
  const ind = indicators.find((i) => i.id === src.indicatorId);
  if (!ind) return { ok: false, reason: "존재하지 않는 지표" };
  if (src.mark && ind.fullSource?.criteriaItems?.length) {
    if (!ind.fullSource.criteriaItems.some((c) => c.mark === src.mark)) {
      return { ok: false, reason: `존재하지 않는 기준 ${src.mark}` };
    }
  }
  if (src.filePage && ind.fullSource?.filePages?.length && !ind.fullSource.filePages.includes(src.filePage)) {
    return { ok: false, visualCheck: true, reason: "쪽수가 이 지표 파일 구간에 없음" };
  }
  if (!src.quote.trim()) return { ok: false, visualCheck: true, reason: "인용 없음" };
  const blob = [
    ind.fullSource?.raw || "",
    ind.fullSource?.sections.criteria.text || "",
    ind.fullSource?.sections.confirm.text || "",
    ind.fullSource?.sections.periodDefault.text || "",
    ind.fullSource?.sections.periodByCriterion.text || "",
    ind.fullSource?.sections.cautions.text || "",
    ind.curr.criteria,
    ind.curr.method,
    ind.curr.period,
  ].join("\n");
  const compact = blob.replace(/\s+/g, "");
  const q = src.quote.replace(/\s+/g, "");
  if (q.length >= 8 && !compact.includes(q.slice(0, Math.min(40, q.length)))) {
    return { ok: false, reason: "원문에 없는 인용" };
  }
  if (ind.fullSource?.needsReview || src.visualCheck) return { ok: true, visualCheck: true };
  return { ok: true };
}

export function filterProposal(p: Proposal, indicators: Indicator[]): Proposal | null {
  const checked = p.sources.map((s) => ({ s, v: sourceAllowed(s, indicators) }));
  const good = checked.filter((c) => c.v.ok);
  if (p.proposed.kind === "original" && good.length === 0) return null;
  const ids = new Set(p.proposed.indicatorIds);
  for (const id of ids) {
    if (!indicators.some((i) => i.id === id)) return null;
  }
  return {
    ...p,
    sources: good.map((c) => ({ ...c.s, visualCheck: c.s.visualCheck || c.v.visualCheck })),
    visualCheck: p.visualCheck || checked.some((c) => c.v.visualCheck || !c.v.ok),
    proposed: {
      ...p.proposed,
      sources: good.map((c) => ({ ...c.s, visualCheck: c.s.visualCheck || c.v.visualCheck })),
    },
  };
}

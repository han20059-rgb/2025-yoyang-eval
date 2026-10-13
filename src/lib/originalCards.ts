import { peelOriginalMethods } from "@/lib/evalCriteria";
import type { PracticeBand, PracticeCard } from "@/lib/practiceGuide";
import type { Indicator } from "@/lib/types";

const DENY = /인정하지\s*않|불인정/;
const EXAMPLE = /\(예시\)|（예시）|표지그림\s*예시|작성안내|면담내용|사유작성\s*예시/;
const PERIOD_HINT = /적용|공고월|평가일|이내|연\s*\d+\s*회|반기|분기|매일|매시간/;

function emphasize(text: string): string[] {
  const re =
    /연\s*\d+\s*회(?:\s*이상)?|반기별\s*1회(?:\s*이상)?|분기별\s*1회(?:\s*이상)?|공휴일|연속\s*\d+\s*시간|매시간|수면시간\s*포함|\d+\s*일\s*이내|근무\s*시작일까지|입사\s*전\s*1년\s*이내|5개\s*영역|EDI|95%\s*이상|소수점\s*첫째자리(?:에서)?\s*반올림|5인\s*이상\s*15인\s*이하|30일\s*이내|지체\s*없이/g;
  return [...new Set(text.match(re) || [])];
}

function itemize(body: string): { text: string; emphasis?: string[] }[] {
  const lines = body
    .split("\n")
    .map((l) => l.replace(/^[∙·•\-]\s*/, "").trim())
    .filter(Boolean);
  if (!lines.length) return [];
  return lines.map((text) => {
    const phrases = emphasize(text);
    return phrases.length ? { text, emphasis: phrases } : { text };
  });
}

function splitBlocks(text: string): string[] {
  const t = text.replace(/▣\s*확인방법\s*/, "").trim();
  if (!t) return [];
  return t
    .split(/(?=￭|※)/)
    .map((s) => s.replace(/^기준\s*[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮](?:\s*[~～∼,，·]\s*[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮])*\s*/, "").trim())
    .filter((s) => s && !/^기준\s*[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮]/.test(s));
}

export function weakConfirm(text: string) {
  const t = text.replace(/기준\s*[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮]\s*/g, "").trim();
  return !t || t === "￭" || /시설급여\s*평가매뉴얼/.test(t);
}

function confirmForMark(indicator: Indicator, mark: string, itemConfirm: string) {
  const full = indicator.fullSource?.sections.confirm.text || "";
  const sliced = full.match(new RegExp(`기준\\s*${mark}([\\s\\S]*?)(?=기준\\s*[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮]|$)`));
  const fromFull = sliced ? sliced[0] : "";
  if (!weakConfirm(itemConfirm)) return itemConfirm;
  if (!weakConfirm(fromFull)) return fromFull;
  return itemConfirm || fromFull;
}

function shortTitle(body: string) {
  const first = body.split("\n")[0]?.replace(/^[∙·•\-]\s*/, "").trim() || "";
  return first || "평가기준";
}

export function originalPracticeCard(
  indicator: Indicator,
  item: { mark: string; text: string; confirm: string; period: string }
): PracticeCard {
  const peeled = peelOriginalMethods(item.text);
  const title = shortTitle(peeled.body);
  const confirm = confirmForMark(indicator, item.mark, item.confirm);
  const bands: PracticeBand[] = [];
  const doItems = itemize(peeled.body);
  if (doItems.length) {
    bands.push({
      kind: "do",
      title: "해야 할 일 · 남길 기록",
      groups: [{ items: doItems }],
    });
  }

  const whenItems: { text: string; emphasis?: string[] }[] = [];
  const denyItems: { text: string; emphasis?: string[] }[] = [];
  const detailParts: string[] = [];

  if (item.period?.trim()) {
    const t = item.period.trim();
    const phrases = emphasize(t);
    whenItems.push(phrases.length ? { text: t, emphasis: phrases } : { text: t });
  }

  for (const block of splitBlocks(confirm)) {
    const entry = emphasize(block).length ? { text: block, emphasis: emphasize(block) } : { text: block };
    if (DENY.test(block) && !EXAMPLE.test(block.split("\n")[0] || "")) {
      denyItems.push(entry);
      continue;
    }
    if (EXAMPLE.test(block)) {
      detailParts.push(block);
      continue;
    }
    if (PERIOD_HINT.test(block) || /^￭/.test(block)) {
      whenItems.push(entry);
      continue;
    }
    detailParts.push(block);
  }

  if (whenItems.length) {
    bands.push({
      kind: "when",
      title: "기한·주기 · 꼭 확인할 조건",
      groups: [{ items: whenItems }],
    });
  }
  if (denyItems.length) {
    bands.push({
      kind: "deny",
      title: "불인정·주의",
      groups: [{ items: denyItems }],
    });
  }

  const details: PracticeCard["details"] = [];
  if (detailParts.length) {
    details.push({ title: "자세한 조건·원문·예시", text: detailParts.join("\n\n") });
  }

  return {
    mark: item.mark,
    title,
    bands,
    details: details.length ? details : undefined,
  };
}

export function originalCardsFor(indicator: Indicator): PracticeCard[] {
  return (indicator.fullSource?.criteriaItems || []).map((it) => originalPracticeCard(indicator, it));
}

export function confirmExtractWeak(indicator: Indicator) {
  const items = indicator.fullSource?.criteriaItems || [];
  return items.filter((it) => weakConfirm(it.confirm) && weakConfirm(confirmForMark(indicator, it.mark, it.confirm))).map((it) => it.mark);
}

import type { ClassifiedFields, ExtractedBlock, PageExtract } from "@/lib/extract/types";

function sliceAround(text: string, startRe: RegExp, endRes: RegExp[]): string {
  const m = startRe.exec(text);
  if (!m) return "";
  const start = m.index;
  let end = text.length;
  for (const re of endRes) {
    re.lastIndex = 0;
    const n = re.exec(text.slice(start + m[0].length));
    if (n && start + m[0].length + n.index < end) {
      end = start + m[0].length + n.index;
    }
  }
  return text.slice(start, end).trim();
}

export function classifyManualText(full: string): ClassifiedFields {
  const ends = [
    /▣\s*확인방법/,
    /▣\s*관련근거/,
    /▣\s*지표적용기간/,
    /평가기준/,
    /채점기준/,
  ];
  return {
    criteria: sliceAround(full, /평가기준/, [/채점기준/, /기준\s*점수/, /▣\s*지표적용기간/, /▣\s*확인방법/]),
    scores: sliceAround(full, /(?:기준\s*점수|채점기준|척도\s+점수)/, [/▣\s*지표적용기간/, /▣\s*확인방법/, /▣\s*관련근거/]),
    method: sliceAround(full, /▣\s*확인방법/, [/▣\s*관련근거/, /평가지표\s+\d+/]),
    period: sliceAround(full, /▣\s*지표적용기간/, [/▣\s*확인방법/, /▣\s*관련근거/, /￭/]),
    frequency: collectLines(full, /(연\s*\d+\s*회|반기별|분기별|매월|매일|주\s*\d+\s*회)/),
    deadline: collectLines(full, /(이내|까지|기한|공고월의 다음)/),
    exceptions: collectLines(full, /(다만|제외|인정하지 않|해당하지 않|예외)/),
    law: sliceAround(full, /▣\s*관련근거/, [/평가지표\s+\d+/, /▣\s*지표적용기간/]),
  };
}

function collectLines(text: string, re: RegExp): string {
  return text
    .split(/\n/)
    .filter((line) => re.test(line))
    .join("\n")
    .trim();
}

export function printedPageOf(text: string): number | null {
  const m = text.match(/-\s*(\d+)\s*-/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function blocksFromPages(pages: PageExtract[]): ExtractedBlock[] {
  const blocks: ExtractedBlock[] = [];
  let n = 0;
  for (const page of pages) {
    const parts = page.text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      n += 1;
      let kind: ExtractedBlock["kind"] = "paragraph";
      if (/평가지표\s*\d+|평가기준|확인방법|관련근거/.test(part.slice(0, 40))) kind = "heading";
      if (/①|②|③|④|⑤/.test(part.slice(0, 8))) kind = "auto-number";
      if (/채점기준|기준\s*점수/.test(part)) kind = "score";
      if (/지표적용기간/.test(part)) kind = "period";
      if (/확인방법/.test(part)) kind = "method";
      if (/다만|인정하지 않|예외/.test(part)) kind = "exception";
      if (/관련근거/.test(part)) kind = "law";
      blocks.push({
        id: `b-${page.page}-${n}`,
        kind,
        page: page.page,
        printedPage: page.printedPage,
        loc: { column: "full" },
        text: part,
        source: "original",
        needsReview: page.needsReview,
        reviewReason: page.reviewReasons[0],
      });
    }
    for (const img of page.images) {
      n += 1;
      blocks.push({
        id: `img-${img.id}`,
        kind: "image",
        page: page.page,
        printedPage: page.printedPage,
        loc: { column: "full" },
        text: img.ocrText || "",
        source: "original",
        needsReview: true,
        reviewReason: img.reviewReason,
      });
    }
    for (const table of page.tables) {
      n += 1;
      blocks.push({
        id: `tbl-${table.id}`,
        kind: "table",
        page: page.page,
        printedPage: page.printedPage,
        loc: { column: "full" },
        text: table.cells.map((c) => `[${c.r},${c.c}] ${c.text}`).join("\n"),
        source: "original",
        needsReview: table.needsReview,
        reviewReason: table.reviewReason,
      });
    }
  }
  return blocks;
}

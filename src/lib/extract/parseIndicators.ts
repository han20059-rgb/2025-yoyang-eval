import type { PageExtract } from "@/lib/extract/types";

export type IndicatorSection = {
  id: string;
  title: string;
  text: string;
  source: "original";
  filePages: number[];
  printedPages: number[];
  needsReview: boolean;
  reviewReason?: string;
};

export type IndicatorFull = {
  id: number;
  name: string;
  raw: string;
  filePages: number[];
  printedPages: number[];
  imagePages: number[];
  sections: {
    direction: IndicatorSection;
    criteria: IndicatorSection;
    methodNote: IndicatorSection;
    scoring: IndicatorSection;
    periodDefault: IndicatorSection;
    periodByCriterion: IndicatorSection;
    confirm: IndicatorSection;
    examples: IndicatorSection;
    cautions: IndicatorSection;
    exceptions: IndicatorSection;
    law: IndicatorSection;
    tablesImages: IndicatorSection;
  };
  lawBlocks: { title: string; text: string }[];
  criteriaItems: { mark: string; text: string; confirm: string; period: string }[];
  needsReview: boolean;
  reviewReasons: string[];
  comparedWithHwp: boolean;
  extractStatus: "extracted" | "needs-review";
  compareStatus: "tool-compared" | "not-compared";
  approveStatus: "unapproved";
  imageOcr?: { page: number; text: string; ok: boolean; error?: string }[];
};

function pagesFor(text: string, pages: PageExtract[]) {
  const filePages: number[] = [];
  const printedPages: number[] = [];
  const imagePages: number[] = [];
  const marker = /\[\[FILE_PAGE:(\d+)\|PRINT:([^\]]*)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = marker.exec(text))) {
    const n = Number(m[1]);
    if (!filePages.includes(n)) filePages.push(n);
    if (m[2]) {
      const pr = Number(m[2]);
      if (Number.isFinite(pr) && !printedPages.includes(pr)) printedPages.push(pr);
    }
  }
  if (filePages.length === 0) {
    const head = text.replace(/\[\[FILE_PAGE:[^\]]+\]\]/g, "").replace(/\s+/g, "").slice(0, 40);
    for (const p of pages) {
      const compact = p.text.replace(/\s+/g, "");
      if (head && compact.includes(head)) {
        filePages.push(p.page);
        if (p.printedPage) printedPages.push(p.printedPage);
      }
    }
  }
  for (const p of pages) {
    if (filePages.includes(p.page) && (p.imageCount > 0 || p.ocrUsed)) imagePages.push(p.page);
  }
  return { filePages, printedPages, imagePages };
}

function cut(text: string, start: RegExp, ends: RegExp[]) {
  const m = start.exec(text);
  if (!m) return "";
  const from = m.index;
  let to = text.length;
  for (const e of ends) {
    const rest = text.slice(from + m[0].length);
    const n = e.exec(rest);
    if (n && from + m[0].length + n.index < to) to = from + m[0].length + n.index;
  }
  return text.slice(from, to).trim();
}

function collect(text: string, re: RegExp) {
  return text
    .split(/\n/)
    .filter((l) => re.test(l))
    .join("\n")
    .trim();
}

function splitLaws(law: string) {
  const parts = law.split(/(?=(?:노인장기요양보험법|노인복지법|사회복지사업법|근로기준법|산업안전보건법|감염병의 예방|폐기물관리법|개인정보 보호법|화재의 예방|화재예방|국민건강보험법|국민연금법|고용보험법|산업재해|사회보장기본법|장기요양기관 평가방법))/);
  const blocks: { title: string; text: string }[] = [];
  for (const p of parts.map((s) => s.trim()).filter(Boolean)) {
    const title = p.split(/\n/)[0].slice(0, 40);
    blocks.push({ title, text: p });
  }
  return blocks;
}

function criteriaItems(criteria: string, confirm: string, periodBy: string) {
  const chunks = criteria.split(/(?=[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮])/);
  const out: IndicatorFull["criteriaItems"] = [];
  for (const chunk of chunks) {
    const m = chunk.match(/^([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮])\s*([\s\S]+)/);
    if (!m) continue;
    const mark = m[1];
    const confirmBit = cut(confirm, new RegExp(`기준${mark}|기준\s*${mark}`), [/기준[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮]/, /▣\s*관련근거/]);
    const periodBit = collect(periodBy, new RegExp(`기준${mark}|${mark}`));
    out.push({ mark, text: m[2].trim(), confirm: confirmBit, period: periodBit });
  }
  return out;
}

function cleanExtract(text: string) {
  return text.replace(/\[\[FILE_PAGE:[^\]]+\]\]/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

function sec(id: string, title: string, text: string, loc: { filePages: number[]; printedPages: number[] }): IndicatorSection {
  const cleaned = cleanExtract(text);
  return {
    id,
    title,
    text: cleaned,
    source: "original",
    filePages: loc.filePages,
    printedPages: loc.printedPages,
    needsReview: !cleaned,
    reviewReason: cleaned ? undefined : `${title}을 이 배포본에서 구분하지 못했습니다. 확인 필요`,
  };
}

export function parseIndicatorsFromPages(pages: PageExtract[]): IndicatorFull[] {
  const full = pages.map((p) => `\n[[FILE_PAGE:${p.page}|PRINT:${p.printedPage ?? ""}]]\n${p.text}`).join("\n");
  const chunks = full.split(/(?=평가지표\s+\d+(?!\s*[\(（]))/);
  const byId = new Map<number, IndicatorFull>();
  for (const chunk of chunks) {
    const m = chunk.match(/평가지표\s+(\d+)\s+([^\n]+)/);
    if (!m) continue;
    const id = Number(m[1]);
    if (!Number.isFinite(id) || id < 1 || id > 45) continue;
    const lines = chunk.replace(/\[\[FILE_PAGE:[^\]]+\]\]/g, "\n").split(/\n/).map((l) => l.trim()).filter(Boolean);
    const hit = lines.findIndex((l) => new RegExp(`^평가지표\\s+${id}\\b`).test(l));
    const after = lines.slice(Math.max(0, hit), hit + 10).filter((l) => !/^평가지표/.test(l) && l !== "점수" && !/^평가방법/.test(l) && !/^평가기준/.test(l) && !/^\d+$/.test(l) && l.length >= 4);
    let name = (after[0] || m[2] || "").replace(/^\s*점수\s*/, "").replace(/\s+/g, " ").trim();
    if (name.length > 40) name = name.slice(0, 40).trim();
    const loc = pagesFor(chunk, pages);
    for (const p of pages) {
      if (new RegExp(`평가지표\\s+${id}(?!\\s*[\\(（])`).test(p.text) && !loc.filePages.includes(p.page)) {
        loc.filePages.unshift(p.page);
      }
    }
    loc.filePages.sort((a, b) => a - b);
    const stop = chunk.search(/\n(?:부록|참고문헌|\[별표|【별표|별표\s*2|평가조사표|\[서식|청구상담봉사|1\)\s*평가방향)/);
    const body = stop > 0 ? chunk.slice(0, stop) : chunk;
    const direction = cut(body, /평가지표\s+\d+/, [/평가기준/, /▣\s*지표적용기간/]);
    const criteria = cut(body, /평가기준/, [/채점기준|기준\s*점수|척도\s+점수/, /▣\s*지표적용기간/]);
    const scoring = cut(body, /(?:채점기준|기준\s*점수|척도\s+점수)/, [/▣\s*지표적용기간/, /▣\s*확인방법/]);
    const periodDefault = cut(body, /▣\s*지표적용기간/, [/▣\s*확인방법/, /▣\s*관련근거/]);
    const confirm = cut(body, /▣\s*확인방법/, [/▣\s*관련근거/, /평가지표\s+\d+/]);
    const law = cut(body, /▣\s*관련근거/, [/평가지표\s+\d+/, /\n부록/, /\n참고/]);
    const examples = collect(body, /예시|예\)/);
    const cautions = collect(body, /※|주의|유의사항/);
    const exceptions = collect(body, /다만|예외|인정하지 않|해당하지 않/);
    const periodByCriterion = collect(periodDefault, /기준[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮]|공고월의 다음|적용/);
    const methodNote = cut(body, /평가방법/, [/채점기준|기준\s*점수/, /▣/]);
    const imgNotes = loc.imagePages.length
      ? `파일 순서 ${loc.imagePages.join(", ")}쪽에 이미지/OCR이 있습니다.`
      : "";
    const reviewReasons = [
      ...[direction, criteria, scoring, periodDefault, confirm].filter((t) => !t).length
        ? ["일부 칸을 원문에서 가르지 못했습니다."]
        : [],
    ];
    if (loc.imagePages.length) reviewReasons.push(imgNotes);
    const item = {
      id,
      name,
      raw: cleanExtract(body),
      filePages: loc.filePages,
      printedPages: [...new Set(loc.printedPages)],
      imagePages: loc.imagePages,
      sections: {
        direction: sec("direction", "평가방향", direction, loc),
        criteria: sec("criteria", "평가기준", criteria, loc),
        methodNote: sec("methodNote", "평가방법", methodNote, loc),
        scoring: sec("scoring", "채점기준", scoring, loc),
        periodDefault: sec("periodDefault", "기본 적용기간", periodDefault, loc),
        periodByCriterion: sec("periodByCriterion", "기준별 적용기간", periodByCriterion, loc),
        confirm: sec("confirm", "확인방법", confirm, loc),
        examples: sec("examples", "예시", examples, loc),
        cautions: sec("cautions", "주의사항", cautions, loc),
        exceptions: sec("exceptions", "예외조건", exceptions, loc),
        law: sec("law", "관련근거", law, loc),
        tablesImages: {
          ...sec(
            "tablesImages",
            "표·이미지",
            imgNotes || "이 지표 파일 구간에서 이미지 페이지는 탐지되지 않았습니다.",
            loc
          ),
          needsReview: loc.imagePages.length > 0,
          reviewReason: loc.imagePages.length ? imgNotes : undefined,
        },
      },
      lawBlocks: splitLaws(law),
      criteriaItems: criteriaItems(criteria, confirm, periodByCriterion),
      needsReview: reviewReasons.length > 0,
      reviewReasons,
      comparedWithHwp: false,
      extractStatus: reviewReasons.length > 0 ? "needs-review" : "extracted",
      compareStatus: "not-compared",
      approveStatus: "unapproved",
    } satisfies IndicatorFull;
    const prev = byId.get(id);
    if (!prev || item.raw.length > prev.raw.length) byId.set(id, item);
  }
  const list = [...byId.values()].sort((a, b) => a.id - b.id);
  applyExclusivePageRanges(list, pages);
  return list;
}

function headingStarts(pages: PageExtract[]) {
  const starts: { id: number; page: number }[] = [];
  for (const p of pages) {
    const re = /평가지표\s+(\d+)(?!\s*[\(（])/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(p.text))) {
      const id = Number(m[1]);
      if (id >= 1 && id <= 45 && !starts.some((s) => s.id === id)) starts.push({ id, page: p.page });
    }
  }
  return starts.sort((a, b) => a.page - b.page || a.id - b.id);
}

function applyExclusivePageRanges(fulls: IndicatorFull[], pages: PageExtract[]) {
  const starts = headingStarts(pages);
  const last = pages[pages.length - 1]?.page || 1;
  for (const f of fulls) {
    const idx = starts.findIndex((s) => s.id === f.id);
    if (idx < 0) continue;
    const from = starts[idx].page;
    let to = idx + 1 < starts.length ? starts[idx + 1].page - 1 : last;
    if (idx === starts.length - 1) {
      const appendix = pages.find((p) => p.page > from && /(^|\n)\s*(부록|참고문헌|\[별표)/.test(p.text));
      if (appendix) to = Math.min(to, appendix.page - 1);
      to = Math.min(to, from + 12);
    }
    const filePages: number[] = [];
    const printedPages: number[] = [];
    const imagePages: number[] = [];
    for (const p of pages) {
      if (p.page < from || p.page > to) continue;
      filePages.push(p.page);
      if (p.printedPage) printedPages.push(p.printedPage);
      if (p.imageCount > 0 || p.ocrUsed || p.images.length) imagePages.push(p.page);
    }
    f.filePages = filePages;
    f.printedPages = [...new Set(printedPages)];
    f.imagePages = imagePages;
    for (const s of Object.values(f.sections)) {
      s.filePages = filePages;
      s.printedPages = f.printedPages;
    }
  }
}

export function auditAgainstBundle(
  fulls: IndicatorFull[],
  bundle: { id: number; name: string; curr: { criteria: string; method: string; law: string; period: string; text: string } }[]
) {
  return fulls.map((f) => {
    const b = bundle.find((x) => x.id === f.id);
    const missing: string[] = [];
    if (!b) missing.push("번들 지표 없음");
    const reasons = [...f.reviewReasons];
    if (b) {
      if ((f.raw.replace(/\s/g, "").length || 0) < 200) reasons.push("원문 길이가 짧아 누락 가능");
      if (!f.sections.law.text && b.curr.law) reasons.push("추출 관련근거가 비었고 번들에는 있음 — 자동 반영하지 않음");
    }
    return {
      id: f.id,
      name: f.name,
      filePages: f.filePages,
      printedPages: f.printedPages,
      imagePages: f.imagePages,
      status: f.needsReview || missing.length ? "needs-review" : "extracted",
      missing,
      reasons,
    };
  });
}

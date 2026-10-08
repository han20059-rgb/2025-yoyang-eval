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
  criteriaItems: {
    mark: string;
    text: string;
    confirm: string;
    period: string;
    methods: string[];
    isNew?: boolean;
    methodScope?: "criterion" | "indicator-common";
  }[];
  commonMethods?: string[];
  commonMethodNote?: string;
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

const CRIT_MARKS = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮";
const METHOD_RUN = "(?:기록|전산|면담|시연|유선|현장(?:\\s*확인)?)(?:\\s*[,，]\\s*(?:기록|전산|면담|시연|유선|현장(?:\\s*확인)?))*";

function sentenceComplete(text: string) {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return false;
  return /(?:다|요)\.\s*$/.test(t) || /까\?\s*$/.test(t) || /입니까\?\s*$/.test(t) || /습니까\?\s*$/.test(t) || /니다\.\s*$/.test(t);
}

function isBulletLine(line: string) {
  return /^[∙·ㆍ\-\※￭▪]/.test(line.trim());
}

function peelLineMeta(line: string): { prose: string; methods: string[]; isNew: boolean } {
  const isNew = /(^|\s)신설(\s|$)/.test(line);
  const t = line
    .replace(/\s*신설\s*/g, " ")
    .replace(/한(현장|면담|기록|전산|시연|유선)/g, "한 $1")
    .replace(/(기록|전산|면담|시연|유선|현장)\.(?=\s*(?:기록|전산|면담|시연|유선|현장))/g, "$1,")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[,，]+$/, "")
    .trim();
  const tail = t.match(new RegExp(`^(.*?)\\s+(${METHOD_RUN})$`));
  if (tail && tail[1].trim()) {
    return { prose: tail[1].trim(), methods: tail[2].split(/[,，]\s*/).map((s) => s.trim()).filter(Boolean), isNew };
  }
  if (new RegExp(`^(${METHOD_RUN})$`).test(t) || /^2\s*1\s*0$/.test(t)) {
    const methods = /^2\s*1\s*0$/.test(t) ? [] : t.split(/[,，]\s*/).map((s) => s.trim()).filter(Boolean);
    return { prose: "", methods, isNew };
  }
  return { prose: t, methods: [], isNew };
}

function joinProse(left: string, right: string) {
  const a = left.replace(/\s+/g, " ").trim();
  const b = right.replace(/\s+/g, " ").trim();
  if (!a) return b;
  if (!b) return a;
  if (a.endsWith("한") && /^다\.?/.test(b)) return a.replace(/한$/, "한다.");
  if (/니$/.test(a) && /^까\??/.test(b)) return `${a}${b}`;
  if (/^(다|한다|이다)\.?/.test(b) && !sentenceComplete(a)) return `${a}${b}`;
  return `${a} ${b}`;
}

type Draft = { mark: string; prose: string[]; bullets: string[]; methods: string[]; isNew: boolean; mainDone: boolean };

function isBulletCont(line: string, d: Draft) {
  if (!d.bullets.length) return false;
  if (isBulletLine(line)) return true;
  const t = line.trim();
  if (/^(주위|등[,，]|및 |또는 )/.test(t)) return true;
  const prev = d.bullets[d.bullets.length - 1] || "";
  return /[,，]\s*$/.test(prev) && t.length < 50 && !sentenceComplete(t);
}

function liftEmbeddedMethods(prose: string): { prose: string; methods: string[] } {
  const methods: string[] = [];
  const next = prose
    .replace(/(^|[\s(（])(기록|전산|면담|시연|유선|현장)[,，.](?=\s*(?:[‧·∙ㆍ(（]|[가-힣]))/g, (_m, pre: string, method: string) => {
      methods.push(method);
      return pre === "(" || pre === "（" ? pre : " ";
    })
    .replace(/\s+‧/g, "‧")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { prose: next, methods };
}

function restoreTitleSpaces(s: string) {
  const tokens = s.trim().split(/\s+/);
  const out: string[] = [];
  let run = "";
  const flush = () => {
    if (run) {
      out.push(run);
      run = "";
    }
  };
  for (const t of tokens) {
    if (t.length === 1 && /^[\uac00-\ud7a3]$/.test(t)) run += t;
    else {
      flush();
      out.push(t);
    }
  }
  flush();
  return out.join(" ").replace(/\s+/g, " ").trim();
}

function restoreSpacedHangul(s: string) {
  const tokens = s.trim().split(/\s+/);
  if (tokens.length < 8) return s;
  const single = tokens.filter((t) => /^[\uac00-\ud7a3]$/.test(t)).length;
  if (single / tokens.length < 0.65) return s;
  return tokens
    .map((t, i) => {
      const prev = tokens[i - 1];
      if (!prev) return t;
      if (/^[\uac00-\ud7a3]$/.test(prev) && /^[\uac00-\ud7a3?!.，,]$/.test(t)) return t;
      return ` ${t}`;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function regroupCriteria(criteria: string): Draft[] {
  const lines = criteria
    .replace(/^평가기준(?:\s*평가방법)?\s*/, "")
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^평가기준/.test(l) && !/^만족\s*보통\s*불만$/.test(l) && !/^\(유선\)$/.test(l));
  const drafts: Draft[] = [];
  let current: Draft | null = null;
  let pending: string[] = [];
  let pendingMethods: string[] = [];
  let pendingNew = false;
  let bindMeta = false;

  function holdNext(prose: string, methods: string[], isNew: boolean) {
    if (prose) pending.push(prose);
    pendingMethods.push(...methods);
    pendingNew = pendingNew || isNew;
  }

  function addProse(d: Draft, prose: string, methods: string[], isNew: boolean) {
    if (bindMeta && !prose) {
      d.methods.push(...methods);
      d.isNew = d.isNew || isNew;
      return;
    }
    if (d.mainDone && prose && !/^(다|한다|이다|까)\.?/.test(prose)) {
      holdNext(prose, methods, isNew);
      bindMeta = false;
      return;
    }
    d.methods.push(...methods);
    d.isNew = d.isNew || isNew;
    if (!prose) return;
    d.prose.push(prose);
    if (sentenceComplete(d.prose.join(" "))) d.mainDone = true;
  }

  for (const line of lines) {
    const marked = line.match(new RegExp(`^([${CRIT_MARKS}])(?:\\s+(.*))?$`));
    if (marked) {
      const lead = marked[2] ? peelLineMeta(marked[2]) : { prose: "", methods: [] as string[], isNew: false };
      if (current && /^(다|한다|이다|까)\.?$/.test(lead.prose)) {
        addProse(current, lead.prose, lead.methods, lead.isNew);
        current = {
          mark: marked[1],
          prose: pending,
          bullets: [],
          methods: pendingMethods,
          isNew: pendingNew,
          mainDone: sentenceComplete(pending.join(" ")),
        };
        pending = [];
        pendingMethods = [];
        pendingNew = false;
        bindMeta = true;
        drafts.push(current);
        continue;
      }
      current = {
        mark: marked[1],
        prose: pending,
        bullets: [],
        methods: pendingMethods,
        isNew: pendingNew,
        mainDone: sentenceComplete(pending.join(" ")),
      };
      pending = [];
      pendingMethods = [];
      pendingNew = false;
      bindMeta = true;
      drafts.push(current);
      if (marked[2]) {
        addProse(current, lead.prose, lead.methods, lead.isNew);
      }
      continue;
    }
    const meta = peelLineMeta(line);
    if (!current) {
      holdNext(meta.prose, meta.methods, meta.isNew);
      continue;
    }
    if (bindMeta && !meta.prose) {
      current.methods.push(...meta.methods);
      current.isNew = current.isNew || meta.isNew;
      continue;
    }
    if (isBulletLine(meta.prose) || isBulletLine(line) || isBulletCont(meta.prose || line, current)) {
      current.bullets.push(line.replace(/\s*신설\s*$/, "").trim());
      current.mainDone = true;
      bindMeta = false;
      continue;
    }
    if (current.mainDone && meta.prose && !/^(다|한다|이다|까)\.?/.test(meta.prose)) {
      bindMeta = false;
    }
    addProse(current, meta.prose, meta.methods, meta.isNew);
  }
  if (pending.length && current) {
    for (const p of pending) current.prose.push(p);
    current.methods.push(...pendingMethods);
    current.isNew = current.isNew || pendingNew;
  }
  return drafts;
}

function criteriaItems(criteria: string, confirm: string, periodBy: string) {
  const drafts = regroupCriteria(criteria);
  const out: IndicatorFull["criteriaItems"] = [];
  for (const d of drafts) {
    let prose = d.prose.reduce((acc, part) => joinProse(acc, part), "").replace(/\s*2\s*1\s*0\s*$/, "").trim();
    prose = restoreSpacedHangul(prose).replace(/([\uac00-\ud7a3])\s+([?!.])/g, "$1$2");
    const lifted = liftEmbeddedMethods(prose);
    prose = lifted.prose;
    d.methods.push(...lifted.methods);
    const tailMeta = prose.match(new RegExp(`^(.*?)\\s+(${METHOD_RUN})[,，]?$`));
    if (tailMeta && sentenceComplete(tailMeta[1])) {
      prose = tailMeta[1].trim();
      d.methods.push(...tailMeta[2].split(/[,，]\s*/).map((s) => s.trim()).filter(Boolean));
    }
    const text = [prose, ...d.bullets].filter(Boolean).join("\n").trim();
    const methods = [...new Set(d.methods.filter((m) => /^(기록|전산|면담|시연|유선|현장)/.test(m)))];
    const confirmBit = cleanExtract(cut(confirm, new RegExp(`기준${d.mark}|기준\\s*${d.mark}`), [/기준[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮]/, /▣\s*관련근거/]));
    const periodBit = collect(periodBy, new RegExp(`기준${d.mark}|${d.mark}`));
    out.push({ mark: d.mark, text, confirm: confirmBit, period: periodBit, methods, isNew: d.isNew || undefined });
  }
  return out;
}

function cleanExtract(text: string) {
  return text.replace(/\[\[FILE_PAGE:[^\]]+\]\]/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

const EVAL_PURPOSE_START =
  /^(기관이|기관은|기관\s자체|수급자|야간근무|욕구사정|배설상태|욕창발생|백신\s|안정적|급여제공계획|급여제공\s시|가족\s|투명한|평가지표에|응급상황|재난상황|전기\s|노인학대|치매예방|수급자의|수급자에게|수급자\()/;

function firstTitleChunk(raw: string) {
  const t = restoreSpacedHangul(raw.replace(/^[)\s]+/, "").replace(/\s+/g, " ").trim());
  if (!t) return "";
  const words = t.split(" ");
  const kept: string[] = [];
  for (const w of words) {
    if (EVAL_PURPOSE_START.test([...kept, w].join(" ")) && kept.length) break;
    if (EVAL_PURPOSE_START.test(w) && kept.length) break;
    kept.push(w);
    if (kept.join(" ").length >= 24) break;
  }
  return kept.join(" ").replace(/\s+\d+$/, "").trim();
}

export function nameFromHeadingLeft(left: string, id: number) {
  let rest = left.replace(/\s+/g, " ").replace(new RegExp(`^.*?평가지표\\s+${id}\\s*`), "").trim();
  rest = rest.replace(/^점수\s*/, "");
  const bits = rest.split(/합니다\.?\s+/);
  const before = (bits[0] || "").trim();
  const after = restoreSpacedHangul((bits.slice(1).join("합니다. ") || "").trim());
  const glued = before.match(/^([\uac00-\ud7a3()및\s]{2,16}?)(보호자|수급자|입소 후|화재|가족 및)/);
  const prefix = glued ? restoreSpacedHangul(glued[1]).trim() : "";
  const trail = before.match(/([\uac00-\ud7a3()]{2,10})$/);
  const trailBit =
    trail && !/(도록|위해|위한|관리|실시|노력|마련|비치|반영|대처|제공|예방|숙지|노|실|적|련|합니|많습니)$/.test(trail[1])
      ? trail[1]
      : "";
  let name = [prefix || trailBit, firstTitleChunk(after)].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  name = name.replace(/현황다\.?$/, "현황").replace(/\)\s*참여강화/, ") 참여강화");
  name = restoreSpacedHangul(name).replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 28 || /합니다/.test(name)) {
    const mid = before.replace(/\s+[\uac00-\ud7a3]$/, "").match(/([\uac00-\ud7a3()및]{2,16}(?:\s+[가-힣()]{1,10})?)$/);
    const fallback = firstTitleChunk(after) || prefix || (mid ? mid[1] : "");
    name = restoreSpacedHangul(fallback).replace(/\s+/g, " ").trim();
  }
  return name;
}

function commonMethodsFromHeading(page?: PageExtract | null) {
  if (!page) return [] as string[];
  const blob = `${page.right}\n${page.left}\n${page.text}`;
  if (/평가방법[\s\S]{0,48}\(\s*유선\s*\)/.test(blob) || /평가방법\s*\(\s*유선\s*\)/.test(blob)) return ["유선"];
  return [];
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
    const loc = pagesFor(chunk, pages);
    for (const p of pages) {
      if (new RegExp(`평가지표\\s+${id}(?!\\s*[\\(（])`).test(p.text) && !loc.filePages.includes(p.page)) {
        loc.filePages.unshift(p.page);
      }
    }
    loc.filePages.sort((a, b) => a - b);
    const headingPage = pages.find((p) => p.page === loc.filePages[0]) || pages.find((p) => new RegExp(`평가지표\\s+${id}(?!\\s*[\\(（])`).test(p.text));
    let name = headingPage?.headingTitle ? restoreTitleSpaces(headingPage.headingTitle) : "";
    if (name.length < 2 && headingPage) name = nameFromHeadingLeft(headingPage.left || headingPage.text, id);
    name = name.replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");
    if (name.length < 2) {
      const after = lines.slice(Math.max(0, hit), hit + 10).filter((l) => !/^평가지표/.test(l) && l !== "점수" && !/^평가방법/.test(l) && !/^평가기준/.test(l) && !/^\d+$/.test(l) && l.length >= 2 && l.length <= 24);
      name = (after[0] || m[2] || "").replace(/^\s*점수\s*/, "").replace(/\s+\d+\s*$/, "").trim();
    }
    const stop = chunk.search(/\n(?:부록|참고문헌|\[별표|【별표|별표\s*2|평가조사표|\[서식|청구상담봉사|1\)\s*평가방향)/);
    const body = stop > 0 ? chunk.slice(0, stop) : chunk;
    const direction = evalPurposeOnly(cut(body, /평가지표\s+\d+/, [/평가기준/, /▣\s*지표적용기간/]), name);
    const criteria = cut(body, /평가기준/, [/채점기준|기준\s*점수|척도\s+점수/, /▣\s*지표적용기간/]).replace(/^평가기준(?:\s*평가방법)?\s*/, "");
    const scoring = cut(body, /(?:채점기준|기준\s*점수|척도\s+점수)/, [/▣\s*지표적용기간/, /▣\s*확인방법/]).replace(/^(?:기준\s*점수\s*)?채점기준\s*/, "");
    const periodDefault = cut(body, /▣\s*지표적용기간/, [/▣\s*확인방법/, /▣\s*관련근거/]);
    const confirm = cut(body, /▣\s*확인방법/, [/▣\s*관련근거/, /평가지표\s+\d+/]);
    const law = cut(body, /▣\s*관련근거/, [/평가지표\s+\d+/, /\n부록/, /\n참고/]);
    const examples = collect(body, /예시|예\)/);
    const cautions = collect(body, /※|주의|유의사항/);
    const exceptions = collect(body, /다만|예외|인정하지 않|해당하지 않/);
    const periodByCriterion = collect(periodDefault, /기준[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮]|공고월의 다음|적용/);
    const parsedItems = criteriaItems(criteria, confirm, periodByCriterion);
    const commonMethods = commonMethodsFromHeading(headingPage);
    const commonMethodNote = commonMethods.length ? `평가방법(${commonMethods.join(", ")}) · 지표 공통` : "";
    if (commonMethods.length) {
      for (const it of parsedItems) {
        if (!it.methods.length) {
          it.methods = [...commonMethods];
          it.methodScope = "indicator-common";
        }
      }
    }
    const methodNote = commonMethodNote
      || parsedItems.map((it) => [it.mark, it.methods.join(", ")].filter((x) => x).join(" ")).join("\n");
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
      lawBlocks: splitLaws(cleanExtract(law)),
      criteriaItems: parsedItems,
      commonMethods,
      commonMethodNote,
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

function evalPurposeOnly(raw: string, _name: string) {
  const t = raw.replace(/\[\[FILE_PAGE:[^\]]+\]\]/g, "\n");
  const matches = [...t.matchAll(/[^\n]{8,200}평가합니다\.?/g)].map((m) => m[0].replace(/\s+/g, " ").trim());
  const purpose = matches.find((p) => p.length >= 12) || "";
  return purpose || t.replace(/\s+/g, " ").trim();
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
      const stopPage = pages.find(
        (p) =>
          p.page > from &&
          /(【별표|\[별표|평가조사표|부록|참고문헌|청구상담봉사|1\)\s*평가방향)/.test(p.text)
      );
      if (stopPage) to = Math.min(to, stopPage.page - 1);
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

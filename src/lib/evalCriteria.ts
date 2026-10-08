import { duties, roles, type RoleId } from "@/data/duties";
import { evidenceForCriterion, evidenceFromText, rolesFromEvidence, type RoleEvidence } from "@/lib/roleAssignments";

function splitScoring(criteria: string) {
  const idx = criteria.search(/기준\s*점수|채점기준|척도\s+점수/);
  if (idx < 0) return { body: criteria.replace(/^평가기준[^\n]*/, "").trim() };
  return { body: criteria.slice(0, idx).replace(/^평가기준[^\n]*/, "").trim() };
}

export type MethodId = "inspect" | "site" | "interview" | "record" | "system" | "demo" | "phone";

export type MethodDef = {
  id: MethodId;
  label: string;
  chip: string;
  word: string;
};

export const METHODS: MethodDef[] = [
  { id: "record", label: "기록", chip: "method-chip method-record", word: "method-word method-record" },
  { id: "system", label: "전산", chip: "method-chip method-system", word: "method-word method-system" },
  { id: "interview", label: "면담", chip: "method-chip method-interview", word: "method-word method-interview" },
  { id: "site", label: "현장", chip: "method-chip method-site", word: "method-word method-site" },
  { id: "inspect", label: "현장확인", chip: "method-chip method-inspect", word: "method-word method-inspect" },
  { id: "demo", label: "시연", chip: "method-chip method-demo", word: "method-word method-demo" },
  { id: "phone", label: "유선", chip: "method-chip method-phone", word: "method-word method-phone" },
];

const METHOD_SPLIT = /(현장\s*확인|면담|시연|전산|기록|유선|현장)/g;
const METHOD_RUN = "(?:기록|전산|면담|시연|유선|현장(?:\\s*확인)?)(?:\\s*[,，]\\s*(?:기록|전산|면담|시연|유선|현장(?:\\s*확인)?))*";

export function methodFromMatch(raw: string): MethodDef {
  const t = raw.replace(/\s+/g, "");
  const id =
    t === "현장확인" ? "inspect" : t === "현장" ? "site" : t === "면담" ? "interview" : t === "기록" ? "record" : t === "전산" ? "system" : t === "시연" ? "demo" : t === "유선" ? "phone" : "";
  return METHODS.find((m) => m.id === id) || METHODS[0];
}

export function extractMethods(text: string): MethodDef[] {
  const found = new Set<MethodId>();
  for (const m of text.matchAll(METHOD_SPLIT)) {
    found.add(methodFromMatch(m[0]).id);
  }
  return METHODS.filter((m) => found.has(m.id));
}

export function uniqueMethods(list: MethodDef[]): MethodDef[] {
  const found = new Set(list.map((m) => m.id));
  return METHODS.filter((m) => found.has(m.id));
}

function methodLabelsIn(raw: string): string[] {
  const t = raw.replace(/\s*신설\s*/g, " ").replace(/[,，.]+$/, "").replace(/\s+/g, " ").trim();
  if (!new RegExp(`^(${METHOD_RUN})$`).test(t)) return [];
  return t.split(/[,，]\s*/).map((s) => s.trim()).filter(Boolean);
}

export function peelOriginalMethods(text: string): { body: string; labels: string[]; methods: MethodDef[]; isNew: boolean } {
  const cleaned = text.replace(/^평가기준(?:\s*평가방법)?\s*\n?/, "");
  const lines = cleaned.split("\n");
  if (!lines[0]) return { body: cleaned.trim(), labels: [], methods: [], isNew: false };
  const labels: string[] = [];
  let isNew = false;
  while (lines.length) {
    const raw = lines[0].trim();
    if (!raw) {
      lines.shift();
      continue;
    }
    if (/(^|\s)신설(\s|$)/.test(raw)) isNew = true;
    const only = methodLabelsIn(raw);
    if (only.length && !raw.replace(/\s*신설\s*/g, " ").replace(/[,，.]+$/g, "").replace(/\s+/g, " ").trim().length) {
      labels.push(...only);
      lines.shift();
      continue;
    }
    if (only.length && new RegExp(`^(${METHOD_RUN})[,.，]?$`).test(raw.replace(/\s*신설\s*/g, " ").trim())) {
      labels.push(...only);
      lines.shift();
      continue;
    }
    if (/^신설$/.test(raw)) {
      lines.shift();
      continue;
    }
    const first = raw.replace(/\s*신설\s*/g, " ").replace(/\s+/g, " ").trim();
    const tail = first.match(new RegExp(`^(.*?)\\s+(${METHOD_RUN})$`));
    const onlyRun = first.match(new RegExp(`^(${METHOD_RUN})$`));
    if (tail && tail[1].trim()) {
      labels.push(...tail[2].split(/[,，]\s*/).map((s) => s.trim()).filter(Boolean));
      lines[0] = tail[1].trim();
      break;
    }
    if (onlyRun) {
      labels.push(...onlyRun[1].split(/[,，]\s*/).map((s) => s.trim()).filter(Boolean));
      lines.shift();
      continue;
    }
    lines[0] = first;
    break;
  }
  let body = lines.join("\n").trim();
  const lifted = body.replace(/(^|[\s(（])(기록|전산|면담|시연|유선|현장)[,，.](?=\s*(?:[‧·∙ㆍ(（]|[가-힣]))/g, (_m, pre: string, method: string) => {
    labels.push(method);
    return pre === "(" || pre === "（" ? pre : " ";
  });
  body = lifted.replace(/\s+‧/g, "‧").replace(/\s{2,}/g, " ").trim();
  const tokens = body.split(/\s+/);
  const single = tokens.filter((t) => /^[\uac00-\ud7a3]$/.test(t)).length;
  if (tokens.length >= 8 && single / tokens.length >= 0.65) {
    body = tokens
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
  const firstBody = body.split("\n")[0] || "";
  if (/(^|\s)신설(\s|$)/.test(firstBody)) {
    isNew = true;
    const rest = body.split("\n");
    rest[0] = rest[0].replace(/\s*신설\s*/g, " ").trim();
    if (!rest[0]) rest.shift();
    body = rest.join("\n").trim();
  }
  body = body.replace(/\s*신설\s*$/g, "").trim();
  return { body, labels, methods: extractMethods(labels.join(" ")), isNew };
}

export function staffCheckKey(indicatorId: number, mark: string, staffId: number) {
  return `${indicatorId}:${mark}:s${staffId}`;
}

export function isStaffCheckRole(role: string) {
  return /^s\d+$/.test(role);
}

export type EvalCriterion = {
  mark: string;
  text: string;
  methods: MethodDef[];
  isNew?: boolean;
};

const MARK_RE = /^([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮])\s*([\s\S]*)/;

export function parseEvalCriteria(criteria: string): EvalCriterion[] {
  const { body } = splitScoring(criteria);
  const chunks = body
    .split(/(?=[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮])/)
    .map((s) => s.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const out: EvalCriterion[] = [];
  for (const chunk of chunks) {
    const m = chunk.match(MARK_RE);
    if (!m) continue;
    const mark = m[1];
    const peeled = peelOriginalMethods(m[2].trim());
    if (peeled.body.length < 6) continue;
    if (/항목을 충족함/.test(peeled.body) && peeled.body.length < 50) continue;
    if (/^(기준\s*점수|채점기준|척도)/.test(peeled.body)) continue;
    if (seen.has(mark)) continue;
    seen.add(mark);
    out.push({ mark, text: peeled.body, methods: peeled.methods.length ? peeled.methods : extractMethods(chunk), isNew: peeled.isNew });
  }
  if (out.length === 0 && body.trim()) {
    out.push({ mark: "①", text: body, methods: extractMethods(body), isNew: false });
  }
  return out;
}

export const roleShort: Record<RoleId, string> = {
  director: "원장",
  office: "사무",
  social: "사회",
  nurse: "간호",
  caregiver: "요양",
  therapist: "치료",
  nutrition: "영양",
  all: "전직원",
};

export function confirmSlice(method: string, mark: string) {
  const m = method.match(new RegExp(`기준\\s*${mark}([\\s\\S]*?)(?=기준\\s*[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮]|$)`));
  return m ? m[0] : "";
}

export function criterionEvidence(id: number, mark: string, text: string, loc?: string, confirm?: string): RoleEvidence[] {
  return evidenceForCriterion(id, mark, { text, confirm, loc: loc || `지표 ${id} 기준 ${mark}` });
}

export function rolesForCriterion(id: number, mark: string, text: string, confirm?: string): RoleId[] {
  return rolesFromEvidence(criterionEvidence(id, mark, text, undefined, confirm));
}

export function rolesForIndicator(id: number, criteriaText?: string, methodText?: string): RoleId[] {
  if (!criteriaText) {
    const found = new Set<RoleId>();
    for (const d of duties) {
      if (d.indicator !== id) continue;
      for (const r of d.roles) {
        if (r !== "all") found.add(r);
      }
    }
    return roles.map((r) => r.id).filter((r) => found.has(r));
  }
  const items = parseEvalCriteria(criteriaText);
  const found = new Set<RoleId>();
  for (const it of items) {
    for (const r of rolesForCriterion(id, it.mark, it.text, confirmSlice(methodText || "", it.mark))) found.add(r);
  }
  return roles.map((r) => r.id).filter((r) => found.has(r));
}

export function assignmentMeta(id: number, criteriaText?: string, methodText?: string): { source: "original" | "none"; directorExplicit: boolean } {
  const list = criteriaText ? rolesForIndicator(id, criteriaText, methodText) : [];
  return { source: list.length ? "original" : "none", directorExplicit: list.includes("director") };
}

export function rolePreparesIndicator(id: number, role: RoleId | "all", criteriaText?: string, methodText?: string): boolean {
  if (role === "all") return true;
  const list = rolesForIndicator(id, criteriaText, methodText);
  return list.includes(role);
}

export function rolePreparesDuty(
  d: { roles: RoleId[]; indicator: number; title: string; how: string },
  role: RoleId | "all",
  criteriaText?: string,
  methodText?: string
): boolean {
  if (role === "all") return true;
  const allowed = criteriaText ? rolesForIndicator(d.indicator, criteriaText, methodText) : d.roles.filter((r) => r !== "all");
  return allowed.includes(role);
}

export function checkKey(indicatorId: number, mark: string, role: RoleId) {
  return `${indicatorId}:${mark}:${role}`;
}

export function splitMethodText(text: string) {
  return text.split(METHOD_SPLIT);
}

export function rolesMentionedIn(text: string): { role: RoleId; label: string }[] {
  const ev = evidenceFromText(0, "①", text, "");
  const labels: Record<string, string> = {
    director: "원장·시설장",
    office: "사무",
    social: "사회복지사",
    nurse: "간호사",
    caregiver: "요양보호사",
    therapist: "치료사",
    nutrition: "영양·조리",
  };
  return ev.map((e) => ({ role: e.role, label: labels[e.role] || e.role }));
}

export function paragraphIsMine(text: string, myRole: RoleId | null | undefined) {
  if (!myRole || myRole === "all") return false;
  return evidenceFromText(0, "①", text, "").some((e) => e.role === myRole);
}

export function criteriaFromIndicator(i: {
  curr: { criteria: string };
  fullSource?: {
    criteriaItems?: { mark: string; text: string; methods?: string[]; isNew?: boolean; methodScope?: "criterion" | "indicator-common" }[];
    commonMethods?: string[];
  } | null;
}): EvalCriterion[] {
  if (i.fullSource?.criteriaItems?.length) {
    return i.fullSource.criteriaItems.map((it) => {
      const peeled = peelOriginalMethods(it.text);
      return {
        mark: it.mark,
        text: peeled.body,
        methods: it.methods?.length ? extractMethods(it.methods.join(" ")) : peeled.methods,
        isNew: Boolean(it.isNew) || peeled.isNew,
      };
    });
  }
  return parseEvalCriteria(i.curr.criteria);
}

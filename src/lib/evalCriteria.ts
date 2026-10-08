import { duties, roles, type RoleId } from "@/data/duties";
import { evidenceForCriterion, evidenceFromText, rolesFromEvidence, type RoleEvidence } from "@/lib/roleAssignments";

function splitScoring(criteria: string) {
  const idx = criteria.search(/기준\s*점수|채점기준|척도\s+점수/);
  if (idx < 0) return { body: criteria.replace(/^평가기준[^\n]*/, "").trim() };
  return { body: criteria.slice(0, idx).replace(/^평가기준[^\n]*/, "").trim() };
}

export type MethodId = "inspect" | "site" | "interview" | "record" | "system" | "demo";

export type MethodDef = {
  id: MethodId;
  label: string;
  chip: string;
  word: string;
};

export const METHODS: MethodDef[] = [
  { id: "inspect", label: "현장확인", chip: "method-chip method-inspect", word: "method-word method-inspect" },
  { id: "site", label: "현장", chip: "method-chip method-site", word: "method-word method-site" },
  { id: "interview", label: "면담", chip: "method-chip method-interview", word: "method-word method-interview" },
  { id: "record", label: "기록", chip: "method-chip method-record", word: "method-word method-record" },
  { id: "system", label: "전산", chip: "method-chip method-system", word: "method-word method-system" },
  { id: "demo", label: "시연", chip: "method-chip method-demo", word: "method-word method-demo" },
];

const METHOD_SPLIT = /(현장\s*확인|면담|시연|전산|기록|현장)/g;

export function methodFromMatch(raw: string): MethodDef {
  const t = raw.replace(/\s+/g, "");
  if (t === "현장확인") return METHODS[0];
  if (t === "현장") return METHODS[1];
  if (t === "면담") return METHODS[2];
  if (t === "기록") return METHODS[3];
  if (t === "전산") return METHODS[4];
  return METHODS[5];
}

export function extractMethods(text: string): MethodDef[] {
  const found = new Set<MethodId>();
  for (const m of text.matchAll(METHOD_SPLIT)) {
    found.add(methodFromMatch(m[0]).id);
  }
  return METHODS.filter((m) => found.has(m.id));
}

export type EvalCriterion = {
  mark: string;
  text: string;
  methods: MethodDef[];
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
    const text = m[2].trim();
    if (text.length < 6) continue;
    if (/항목을 충족함/.test(text) && text.length < 50) continue;
    if (/^(기준\s*점수|채점기준|척도)/.test(text)) continue;
    if (seen.has(mark)) continue;
    seen.add(mark);
    out.push({ mark, text, methods: extractMethods(chunk) });
  }
  if (out.length === 0 && body.trim()) {
    out.push({ mark: "①", text: body, methods: extractMethods(body) });
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

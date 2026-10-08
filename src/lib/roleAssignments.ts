import type { RoleId } from "@/data/duties";
import { roles } from "@/data/duties";

export type RoleEvidence = {
  indicatorId: number;
  mark: string;
  role: RoleId;
  task: string;
  quote: string;
  loc: string;
};

const SUBJECTS: { role: RoleId; label: string; subj: RegExp }[] = [
  { role: "director", label: "원장·시설장", subj: /(?:시설장|원장)(?:이|은)/ },
  { role: "office", label: "사무국장·사무원", subj: /(?:사무국장|사무원)(?:이|은)/ },
  { role: "social", label: "사회복지사", subj: /사회복지사(?:가|는|이)/ },
  { role: "nurse", label: "간호사·간호조무사", subj: /간호(?:조무)?사(?:가|는|이)/ },
  { role: "caregiver", label: "요양보호사", subj: /요양보호사(?:가|는|이)/ },
  { role: "therapist", label: "물리·작업치료사", subj: /(?:물리치료사|작업치료사|물리\s*\(?작업\)?치료사)(?:가|는|이)/ },
  { role: "nutrition", label: "영양사·조리", subj: /(?:영양사|조리사|조리원)(?:가|는|이)/ },
];

const LISTED: { role: RoleId; re: RegExp }[] = [
  { role: "director", re: /시설장|원장/ },
  { role: "office", re: /사무국장|사무원/ },
  { role: "social", re: /사회복지사/ },
  { role: "nurse", re: /간호(?:조무)?사/ },
  { role: "caregiver", re: /요양보호사/ },
  { role: "therapist", re: /물리치료사|작업치료사|물리\s*\(?작업\)?치료사/ },
  { role: "nutrition", re: /영양사|조리사|조리원/ },
];

const WORK = /실시|개최|작성|점검|수립|제공|관리|반영|기록|방문|측정|계획|운영한다|비치|숙지|시연|참여/;

function skipGeneric(s: string) {
  if (/사회복지사업법/.test(s)) return true;
  return false;
}

function isTraineeOrObject(s: string, roleRe: RegExp) {
  const windowed = s;
  if (new RegExp(`${roleRe.source}(?:에게|를 대상|을 대상)`).test(windowed)) return true;
  if (/(?:모든\s*)?(?:직원|급여제공직원)에게/.test(s) && roleRe.test(s) === false) return true;
  return false;
}

function clauses(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=다\.|다\)|니다\.|까\?)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
}

export function evidenceFromText(indicatorId: number, mark: string, text: string, loc: string): RoleEvidence[] {
  const out: RoleEvidence[] = [];
  const seen = new Set<string>();
  const add = (role: RoleId, quote: string, task: string) => {
    const k = `${role}:${quote.slice(0, 40)}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ indicatorId, mark, role, task, quote: quote.slice(0, 180), loc });
  };

  for (const s of clauses(text)) {
    if (skipGeneric(s)) continue;
    const educate = /교육/.test(s) && /실시/.test(s);
    if (educate) {
      for (const sub of SUBJECTS) {
        if (sub.subj.test(s) && !isTraineeOrObject(s, sub.subj)) add(sub.role, s, "교육 실시");
      }
      continue;
    }
    if (/면담\s*대상|평가자/.test(s) && !SUBJECTS.some((x) => x.subj.test(s) && WORK.test(s))) continue;

    if (/필수/.test(s) && /시설장|사회복지사|요양보호사|간호/.test(s) && /사례/.test(s)) {
      for (const L of LISTED) {
        if (L.re.test(s) && !/사회복지사업법/.test(s)) add(L.role, s, "사례회의 참여");
      }
      continue;
    }

    for (const sub of SUBJECTS) {
      if (!sub.subj.test(s)) continue;
      if (isTraineeOrObject(s, sub.subj)) continue;
      if (!WORK.test(s)) continue;
      if (/(?:기관|직원|담당자)(?:이|가|은|는)/.test(s) && !sub.subj.test(s)) continue;
      add(sub.role, s, "원문에 수행 주체로 적힌 일");
    }
  }
  return out;
}

export function evidenceForCriterion(
  indicatorId: number,
  mark: string,
  parts: { text: string; confirm?: string; loc: string }
): RoleEvidence[] {
  const blob = `${parts.text}\n${parts.confirm || ""}`;
  return evidenceFromText(indicatorId, mark, blob, parts.loc);
}

export function rolesFromEvidence(list: RoleEvidence[]): RoleId[] {
  const found = new Set(list.map((e) => e.role));
  return roles.map((r) => r.id).filter((id) => found.has(id) && id !== "all");
}

export function myEvidence(list: RoleEvidence[], role: RoleId | null | undefined) {
  if (!role || role === "all") return [];
  return list.filter((e) => e.role === role);
}

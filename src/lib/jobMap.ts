import type { RoleId } from "@/data/duties";

const MAP: { test: RegExp; role: RoleId }[] = [
  { test: /시설장|원장|관리책임자/, role: "director" },
  { test: /사무국장|사무원/, role: "office" },
  { test: /사회복지/, role: "social" },
  { test: /간호/, role: "nurse" },
  { test: /요양보호/, role: "caregiver" },
  { test: /물리치료|작업치료/, role: "therapist" },
  { test: /영양|조리/, role: "nutrition" },
];

export function mapJobType(jobType: string): { role: RoleId | null; status: "mapped" | "review"; note: string } {
  const raw = (jobType || "").trim();
  if (!raw) return { role: null, status: "review", note: "근무 직종이 비어 평가 직종을 연결하지 못했습니다." };
  const hit = MAP.find((m) => m.test.test(raw));
  if (!hit) {
    return { role: null, status: "review", note: `근무 직종 ‘${raw}’에 대한 평가 직종 연결은 확정하지 않았습니다.` };
  }
  return { role: hit.role, status: "mapped", note: `근무 직종과 평가 직종(${hit.role})을 따로 두었습니다.` };
}

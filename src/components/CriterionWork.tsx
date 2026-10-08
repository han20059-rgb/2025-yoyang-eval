"use client";

import { AssignPicker, type DirStaff } from "@/components/AssignPicker";
import { DirectivePanel } from "@/components/DirectivePanel";
export type { DirStaff };
import { useAssignments } from "@/components/AssignmentProvider";
import { useEvalSession } from "@/components/EvalSession";
import { useProgress } from "@/components/ProgressProvider";
import { roles, type RoleId } from "@/data/duties";
import { combinedRoles } from "@/lib/assignmentMerge";
import { confirmSlice, peelOriginalMethods, rolesForCriterion, roleShort } from "@/lib/evalCriteria";
import { parseStaffTags, roleLabel } from "@/lib/situation";
import type { Indicator } from "@/lib/types";

export function CriterionWork({
  indicator,
  mark,
  originalText,
  staffDir,
}: {
  indicator: Indicator;
  mark: string;
  originalText: string;
  staffDir: DirStaff[];
}) {
  const { identity, mode } = useEvalSession();
  const { adminRoles, map, reload } = useAssignments();
  const { isChecked, toggle, needsRecheck } = useProgress();
  const isAdmin = Boolean(identity?.isAdmin);
  const method = `${indicator.curr.method}\n${indicator.fullSource?.sections.confirm.text || ""}`;
  const peeled = peelOriginalMethods(originalText);
  const ov = map.get(`${indicator.id}:${mark}`);
  const manual = rolesForCriterion(indicator.id, mark, peeled.body, confirmSlice(method, mark));
  const combined = combinedRoles(manual, adminRoles(indicator.id, mark), ov?.excludeRoles);
  const staff = parseStaffTags(ov?.staffNames || [], ov?.staffIds);
  const canRole = (r: RoleId) => Boolean(identity?.isAdmin || identity?.evalRole === r);
  const canStaff = (id: number) => Boolean(identity?.isAdmin || identity?.leaveRecordId === id);

  return (
    <div className="mt-2 space-y-2">
      {needsRecheck(indicator.id, mark) ? <p className="text-sm text-amber-800">재확인 필요</p> : null}
      <ul className="space-y-1 text-[15px] leading-6">
        {combined.map((c) => (
          <li key={c.role} className="flex flex-wrap items-center gap-2">
            <span>
              {roleLabel(c.role)} · {c.kind === "manual" ? "매뉴얼 명시" : "관리자 지정"}
            </span>
            {canRole(c.role) ? (
              <button
                type="button"
                className={`min-h-11 rounded-xl border px-3 ${isChecked(indicator.id, mark, c.role) ? "bg-teal-600 text-white" : "bg-white"}`}
                onClick={() => toggle(indicator.id, mark, c.role)}
              >
                {roleShort[c.role]} {isChecked(indicator.id, mark, c.role) ? "준비됨" : "준비"}
              </button>
            ) : (
              <span className="text-sm text-stone-500">{isChecked(indicator.id, mark, c.role) ? "준비됨" : "미완료"}</span>
            )}
          </li>
        ))}
        {staff.map((s) => (
          <li key={s.id || s.name} className="flex flex-wrap items-center gap-2">
            <span>{s.name} · 개인 담당</span>
            {s.id && canStaff(s.id) ? (
              <button
                type="button"
                className={`min-h-11 rounded-xl border px-3 ${isChecked(indicator.id, mark, `s${s.id}`) ? "bg-teal-600 text-white" : "bg-white"}`}
                onClick={() => toggle(indicator.id, mark, `s${s.id}`)}
              >
                개인 {isChecked(indicator.id, mark, `s${s.id}`) ? "준비됨" : "준비"}
              </button>
            ) : (
              <span className="text-sm text-stone-500">개인 담당은 본인 체크로 완료합니다</span>
            )}
          </li>
        ))}
        {!combined.length && !staff.length ? <li>담당 미지정</li> : null}
      </ul>
      {combined.length > 1 || staff.length > 1 ? (
        <details>
          <summary className="min-h-11 cursor-pointer text-sm">공동 담당 펼치기</summary>
          <p className="text-sm text-stone-600">
            {combined.map((c) => `${roleLabel(c.role)}(${c.kind === "manual" ? "매뉴얼" : "관리자"})`).join(", ")}
            {staff.length ? ` · ${staff.map((s) => s.name).join(", ")}` : ""}
          </p>
        </details>
      ) : null}
      {isAdmin || mode === "demo" ? (
        <AssignPicker
          indicatorId={indicator.id}
          mark={mark}
          manual={manual}
          currentRoles={combined.map((c) => c.role)}
          currentStaff={staff}
          recheckRoles={ov?.recheckRoles || []}
          staffDir={staffDir}
          onSaved={() => reload()}
        />
      ) : null}
      <DirectivePanel
        indicatorId={indicator.id}
        mark={mark}
        targetRoles={combined.map((c) => c.role)}
        targetStaff={staff}
      />
    </div>
  );
}

export function roleName(id: RoleId) {
  return roles.find((r) => r.id === id)?.label || id;
}

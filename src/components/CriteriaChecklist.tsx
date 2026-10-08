"use client";

import { MethodHeading, MethodText } from "@/components/MethodText";
import { ProgressCounts } from "@/components/ProgressBoard";
import { useAssignments } from "@/components/AssignmentProvider";
import { useEvalSession } from "@/components/EvalSession";
import { useProgress } from "@/components/ProgressProvider";
import { combinedRoles } from "@/lib/assignmentMerge";
import { roles, type RoleId } from "@/data/duties";
import { confirmSlice, criterionEvidence, parseEvalCriteria, roleShort, rolesForCriterion } from "@/lib/evalCriteria";
import type { Indicator } from "@/lib/types";

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-stone-200">
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${pct === 100 ? "bg-teal-600" : "bg-(--teal)"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function DeptCheck({
  checked,
  label,
  onToggle,
  dim,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
  dim?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex min-h-11 w-full items-center gap-1 rounded-xl border px-3 py-2 text-left text-[16px] font-semibold transition ${
        checked
          ? "border-teal-600 bg-teal-600 text-white"
          : "border-stone-300 bg-white text-stone-600 hover:border-(--teal)"
      } ${dim ? "opacity-40" : ""}`}
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full border ${
          checked ? "border-white bg-white text-teal-700" : "border-stone-300"
        }`}
      >
        {checked ? "✓" : ""}
      </span>
      {label}
    </button>
  );
}

export function CriteriaChecklist({
  indicator,
  query,
}: {
  indicator: Indicator;
  query?: string;
}) {
  const { isChecked, needsRecheck, toggle, statsFor, viewRole, recentEvents } = useProgress();
  const { mode, identity } = useEvalSession();
  const { adminRoles, map } = useAssignments();
  const items = parseEvalCriteria(indicator.curr.criteria);
  const method = `${indicator.curr.method}\n${indicator.fullSource?.sections.confirm.text || ""}`;
  const unassigned = items.filter((it) => {
    const confirm = confirmSlice(method, it.mark);
    return combinedRoles(rolesForCriterion(indicator.id, it.mark, it.text, confirm), adminRoles(indicator.id, it.mark), map.get(`${indicator.id}:${it.mark}`)?.excludeRoles).length === 0;
  });
  const stat = statsFor(indicator, "all");
  const mine = viewRole === "all" ? null : statsFor(indicator, viewRole);

  if (items.length === 0) {
    return <MethodText text={indicator.curr.criteria} query={query} emphasize />;
  }

  function canToggle(r: RoleId) {
    if (mode === "demo") return true;
    if (mode === "staff" && identity?.evalRole) return r === identity.evalRole;
    return false;
  }

  return (
    <div id="checklist" className="scroll-mt-4 space-y-3">
      <div className="rounded-xl bg-stone-50 px-3 py-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <ProgressCounts done={stat.done} left={stat.left} complete={stat.complete} />
          {mine && viewRole !== "all" ? (
            <p className="text-xs text-stone-600">
              {roles.find((r) => r.id === viewRole)?.label}:{" "}
              {mine.complete ? "우리 부서 완료" : `남은 기준 ${mine.left}개`}
            </p>
          ) : null}
        </div>
        <div className="mt-2">
          <ProgressBar done={stat.done} total={stat.total} />
        </div>
      </div>

      {unassigned.length && viewRole === "all" ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[15px] leading-7 text-amber-900">
          담당 미지정 기준 {unassigned.map((u) => u.mark).join(" ")} — 원문에 수행 직종이 없어 완료율에 넣지 않습니다.
        </p>
      ) : null}
      {items.map((it) => {
        const confirm = confirmSlice(method, it.mark);
        const combined = combinedRoles(rolesForCriterion(indicator.id, it.mark, it.text, confirm), adminRoles(indicator.id, it.mark), map.get(`${indicator.id}:${it.mark}`)?.excludeRoles);
        const dept = combined.map((c) => c.role);
        const ov = map.get(`${indicator.id}:${it.mark}`);
        const row = stat.items.find((s) => s.mark === it.mark);
        const ev = criterionEvidence(
          indicator.id,
          it.mark,
          it.text,
          `지표 ${indicator.id} · ${indicator.name} 기준 ${it.mark} · 파일 ${(indicator.fullSource?.filePages || indicator.pages)[0]}쪽`,
          confirm
        );
        const mineEv = viewRole !== "all" ? ev.filter((e) => e.role === viewRole) : [];
        return (
          <article
            id={`crit-${indicator.id}-${it.mark}`}
            key={it.mark}
            className={`scroll-mt-4 rounded-xl border px-3 py-3 ${
              row?.complete ? "border-teal-200 bg-teal-50/40" : "border-stone-200 bg-white"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <span className="text-lg font-bold text-(--teal)">{it.mark}</span>
                <MethodHeading methods={it.methods} isNew={it.isNew} />
                {needsRecheck(indicator.id, it.mark) ? (
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-900">재확인 필요</span>
                ) : null}
              </div>
              <p className="text-xs font-semibold">
                {row?.complete ? (
                  <span className="text-teal-700">완료 {row.done}</span>
                ) : (
                  <>
                    <span className="text-teal-700">완료 {row?.done}</span>
                    <span className="ml-1.5 text-amber-800">미완료 {row?.leftRoles.length}</span>
                  </>
                )}
              </p>
            </div>
            <div className={`mt-2 ${mineEv.length ? "rounded-lg bg-teal-50 px-2 py-2" : ""}`}>
              <MethodText text={it.text} query={query} emphasize />
            </div>
            {mineEv.length ? (
              <div className="mt-2 text-[15px] leading-7">
                <p className="text-[13px] font-semibold text-teal-800">매뉴얼 명시 담당 · 담당 근거</p>
                <p>{mineEv[0].quote}</p>
                <p className="text-sm text-stone-600">{mineEv[0].loc}</p>
              </div>
            ) : null}
            {ov && combined.some((c) => c.kind === "admin" && c.role === viewRole) ? (
              <div className="mt-2 text-[15px] leading-7">
                <p className="text-[13px] font-semibold text-teal-800">관리자 지정 담당</p>
                <p>지정 사유: {ov.reason || "사유 없음"}</p>
                <p className="text-sm text-stone-600">{ov.actorName} · {ov.updatedAt?.slice(0, 16).replace("T", " ")}</p>
              </div>
            ) : null}
            {dept.length === 0 ? (
              <p className="mt-2 text-sm text-amber-800">이 기준은 담당 미지정입니다. 근거 문장을 만들지 않았습니다.</p>
            ) : null}
            {dept.length > 1 ? (
              <details className="mt-2 text-[14px] text-stone-600">
                <summary className="cursor-pointer">공동 담당 직종 이름</summary>
                {dept.map((r) => roles.find((x) => x.id === r)?.label).join(" · ")}
              </details>
            ) : null}
            <div className="mt-3 flex flex-col gap-1.5">
              {dept.map((r) => {
                const dim = viewRole !== "all" && r !== viewRole;
                const allowed = canToggle(r);
                return (
                  <DeptCheck
                    key={r}
                    checked={isChecked(indicator.id, it.mark, r)}
                    label={`${roleShort[r]} · ${combined.find((c) => c.role === r)?.kind === "admin" ? "관리자 지정" : "매뉴얼 명시"}`}
                    dim={dim || !allowed}
                    onToggle={() => {
                      if (!allowed) return;
                      toggle(indicator.id, it.mark, r);
                    }}
                  />
                );
              })}
            </div>
            <ul className="mt-2 space-y-1 text-sm text-stone-500">
              {recentEvents
                .filter((e) => e.indicator_id === indicator.id && e.mark === it.mark)
                .slice(0, 3)
                .map((e, idx) => (
                  <li key={`${e.created_at}-${idx}`}>
                    {e.actor_name}
                    {e.as_admin ? "(관리자)" : ""} · {e.action === "complete" ? "완료" : "취소"} · {e.created_at.slice(0, 16).replace("T", " ")}
                  </li>
                ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}

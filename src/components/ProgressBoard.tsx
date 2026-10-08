"use client";

import { useMemo, useState } from "react";
import { CriteriaChecklist } from "@/components/CriteriaChecklist";
import { useEvalSession } from "@/components/EvalSession";
import { useProgress } from "@/components/ProgressProvider";
import { roles, type RoleId } from "@/data/duties";
import { useAssignments } from "@/components/AssignmentProvider";
import { combinedRoles } from "@/lib/assignmentMerge";
import { assignmentMeta, confirmSlice, parseEvalCriteria, rolePreparesIndicator, rolesForCriterion, rolesForIndicator } from "@/lib/evalCriteria";
import type { Indicator } from "@/lib/types";

export function ProgressBoard({ indicators }: { indicators: Indicator[] }) {
  const { identity, mode } = useEvalSession();
  const { viewRole, setViewRole, statsFor, needsRecheck, saveStatus, saveMessage } = useProgress();
  const { adminRoles, map } = useAssignments();
  const [filter, setFilter] = useState<"open" | "all" | "done" | "recheck">("open");
  const [openId, setOpenId] = useState<number | null>(null);

  const role = viewRole;
  const rows = useMemo(() => {
    return indicators
      .filter((i) => {
        if (role === "all") return true;
        if (rolePreparesIndicator(i.id, role, i.curr.criteria, i.curr.method)) return true;
        return parseEvalCriteria(i.curr.criteria).some((it) => adminRoles(i.id, it.mark).includes(role));
      })
      .map((i) => {
        const mine = role === "all" ? statsFor(i, "all") : statsFor(i, role);
        const items = parseEvalCriteria(i.curr.criteria);
        const orgRoles = [
          ...new Set(
            items.flatMap((it) =>
              combinedRoles(
                rolesForCriterion(i.id, it.mark, it.text, confirmSlice(i.curr.method, it.mark)),
                adminRoles(i.id, it.mark),
                map.get(`${i.id}:${it.mark}`)?.excludeRoles
              ).map((c) => c.role)
            )
          ),
        ];
        const jointDone = orgRoles.filter((r) => statsFor(i, r).complete).length;
        const unassigned = items.filter((it) => combinedRoles(rolesForCriterion(i.id, it.mark, it.text, confirmSlice(i.curr.method, it.mark)), adminRoles(i.id, it.mark), map.get(`${i.id}:${it.mark}`)?.excludeRoles).length === 0);
        const allRolesReady = orgRoles.length > 0 && orgRoles.every((r) => statsFor(i, r).complete) && unassigned.length === 0;
        const recheck = mine.items.some((it) => needsRecheck(i.id, it.mark));
        return { i, mine, orgRoles, jointDone, allRolesReady, recheck, unassigned, meta: assignmentMeta(i.id, i.curr.criteria, i.curr.method) };
      });
  }, [indicators, role, statsFor, needsRecheck, adminRoles, map]);

  const shown = rows.filter((r) => {
    if (filter === "open") return !r.mine.complete;
    if (filter === "done") return r.mine.complete;
    if (filter === "recheck") return r.recheck;
    return true;
  });

  const mineTotal = rows.reduce((n, r) => n + r.mine.total, 0);
  const mineDone = rows.reduce((n, r) => n + r.mine.done, 0);
  const unassignedAll = rows.flatMap((r) => r.unassigned.map((u) => ({ id: r.i.id, name: r.i.name, mark: u.mark, text: u.text })));

  return (
    <section className="space-y-4 rounded-2xl border border-(--line) bg-(--card) p-4">
      <div>
        <p className="text-xs font-medium tracking-wide text-(--teal)">직종별 상황판</p>
        <h2 className="text-xl font-bold">준비 현황</h2>
        <p className="mt-1 text-[16px] leading-7 text-stone-700">
          {role === "all"
            ? "기관 전체 조회입니다. 완료는 준비 체크이며 평가점수가 아닙니다."
            : `${roles.find((r) => r.id === role)?.label} 담당 기준 ${mineTotal}개 중 ${mineDone}개 준비 완료 · ${mineTotal - mineDone}개 남음`}
        </p>
        {identity && mode !== "anon" ? (
          <p className="mt-1 text-sm text-stone-500">
            {identity.name} · 근무 {identity.jobType || "미입력"} · 평가 직종 {identity.evalRole || "미연결"}
          </p>
        ) : null}
        <p className="mt-2 text-sm">
          {saveStatus === "saving" ? "저장 중" : saveStatus === "saved" ? "저장됨" : saveStatus === "failed" ? `저장 실패 · ${saveMessage}` : saveStatus === "unready" ? saveMessage : saveMessage}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        {(["open", "all", "done", "recheck"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`min-h-11 w-full rounded-xl border px-3 text-left text-[16px] ${filter === f ? "border-(--teal) bg-(--teal) text-white" : "border-stone-200 bg-white"}`}
          >
            {f === "open" ? "미완료" : f === "all" ? "전체" : f === "done" ? "완료" : "재확인"}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <button type="button" onClick={() => setViewRole("all")} className={`min-h-11 w-full rounded-xl border px-3 text-left ${role === "all" ? "bg-(--teal) text-white" : "bg-white"}`}>
          전체 조회 (관리자)
        </button>
        {roles
          .filter((r) => r.id !== "all")
          .map((r) => (
            <button key={r.id} type="button" onClick={() => setViewRole(r.id as RoleId)} className={`min-h-11 w-full rounded-xl border px-3 text-left ${role === r.id ? "bg-(--teal) text-white" : "bg-white"}`}>
              {r.label}
            </button>
          ))}
      </div>
      <ul className="space-y-2">
        {shown.map(({ i, mine, orgRoles, jointDone, allRolesReady, recheck, unassigned, meta }) => (
          <li key={i.id} className="rounded-xl border border-stone-200">
            <button type="button" className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-3 text-left" onClick={() => setOpenId(openId === i.id ? null : i.id)}>
              <span className="text-[16px] font-semibold">
                {i.id}. {i.name}
              </span>
              <span className="shrink-0 text-sm text-stone-600">
                {mine.done}/{mine.total}
                {recheck ? " · 재확인" : ""}
                {openId === i.id ? " · 접기" : " · 펼치기"}
              </span>
            </button>
            {openId === i.id ? (
              <div className="space-y-2 border-t border-stone-100 px-3 py-3">
                {orgRoles.length > 1 ? (
                  <p className="text-sm text-stone-600">
                    공동 담당 {orgRoles.length}개 직종 중 {jointDone}개 준비 완료
                    <details className="mt-1">
                      <summary className="cursor-pointer">공동 담당 직종 이름</summary>
                      {orgRoles.map((r) => roles.find((x) => x.id === r)?.label).join(" · ")}
                    </details>
                  </p>
                ) : null}
                <p className="text-sm text-stone-500">
                  {allRolesReady ? "필수 담당 직종 준비가 모두 끝나 이 지표는 기관 준비 완료로 집계합니다. 평가점수 확보가 아닙니다." : "기관 전체 완료는 필수 담당 직종이 모두 준비된 뒤에만 셉니다."}
                </p>
                {unassigned.length ? (
                  <p className="text-sm text-amber-800">
                    담당 미지정 {unassigned.map((u) => u.mark).join(" ")} — 기관 전체 완료로 세지 않습니다.
                  </p>
                ) : null}
                {meta.source === "none" ? (
                  <p className="text-sm text-amber-800">원문에 수행 직종이 없어 이 지표는 담당 미지정입니다.</p>
                ) : (
                  <p className="text-sm text-stone-500">원문에 수행 주체로 적힌 직종만 담당입니다.</p>
                )}
                <CriteriaChecklist indicator={i} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {role === "all" && unassignedAll.length ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <h3 className="text-[16px] font-bold">담당 미지정 기준 {unassignedAll.length}개</h3>
          <p className="mt-1 text-sm text-amber-900">원문에 수행 직종이 없습니다. 이 목록이 빠지면 기관 전체가 완료된 것처럼 보입니다.</p>
          <ul className="mt-2 space-y-2 text-[16px] leading-7">
            {unassignedAll.map((u) => (
              <li key={`${u.id}-${u.mark}`}>
                지표 {u.id} · {u.name} {u.mark}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

export function ProgressCounts({
  done,
  left,
  complete,
}: {
  done: number;
  left: number;
  complete: boolean;
}) {
  if (complete) {
    return <span className="rounded-full bg-teal-100 px-2 py-1 text-xs font-semibold text-teal-800">완료 {done}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span className="rounded-full bg-teal-100 px-2 py-1 text-xs font-semibold text-teal-800">완료 {done}</span>
      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">미완료 {left}</span>
    </span>
  );
}

export function IndicatorProgressBadge({ indicator }: { indicator: Indicator }) {
  const { statsFor, viewRole } = useProgress();
  const s = statsFor(indicator, viewRole);
  if (!s.total) return null;
  return <ProgressCounts done={s.done} left={s.left} complete={s.complete} />;
}

"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useProgress } from "@/components/ProgressProvider";
import { roles } from "@/data/duties";
import { rolesForIndicator } from "@/lib/evalCriteria";
import type { Indicator } from "@/lib/types";

export function ProgressBoard({ indicators }: { indicators: Indicator[] }) {
  const { viewRole, setViewRole, statsFor } = useProgress();

  const rows = useMemo(
    () =>
      indicators.map((i) => ({
        i,
        all: statsFor(i, "all"),
        mine: viewRole === "all" ? null : statsFor(i, viewRole),
        roles: rolesForIndicator(i.id),
      })),
    [indicators, statsFor, viewRole]
  );

  const deptCards = useMemo(() => {
    return roles
      .filter((r) => r.id !== "all")
      .map((r) => {
        const involved = indicators.filter((i) => rolesForIndicator(i.id).includes(r.id) || rolesForIndicator(i.id).includes("all"));
        let done = 0;
        let total = 0;
        for (const i of involved) {
          const s = statsFor(i, r.id);
          done += s.done;
          total += s.total;
        }
        return { role: r, done, total, left: total - done, pct: total ? Math.round((done / total) * 100) : 0 };
      });
  }, [indicators, statsFor]);

  const overall = useMemo(() => {
    let done = 0;
    let total = 0;
    for (const r of rows) {
      done += r.all.done;
      total += r.all.total;
    }
    return { done, total, left: total - done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [rows]);

  const filtered = viewRole === "all" ? rows : rows.filter((r) => r.roles.includes(viewRole) || r.roles.includes("all"));
  const focus = viewRole === "all" ? overall : deptCards.find((d) => d.role.id === viewRole);

  return (
    <section className="space-y-4 rounded-2xl border border-(--line) bg-(--card) p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-(--teal)">관리자 · 부서 진행</p>
          <h2 className="text-xl font-bold">준비 현황</h2>
          <p className="mt-1 text-sm text-stone-600">
            평가기준마다 해당 부서가 체크합니다. 이 컴퓨터 브라우저에 저장됩니다.
          </p>
        </div>
        <div className="min-w-48">
          <p className="text-sm font-semibold">
            {viewRole === "all" ? (
              overall.left === 0 ? (
                <span className="text-teal-700">전체 완료</span>
              ) : (
                <>
                  {overall.done}/{overall.total} 완료
                  <span className="ml-2 text-amber-800">미완료 {overall.left}개</span>
                </>
              )
            ) : (
              <>
                {roles.find((r) => r.id === viewRole)?.label} {focus?.pct ?? 0}%
                {focus && focus.left > 0 ? (
                  <span className="ml-2 text-amber-800">남은 기준 {focus.left}개</span>
                ) : (
                  <span className="ml-2 text-teal-700">완료</span>
                )}
              </>
            )}
          </p>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full rounded-full bg-(--teal) transition-[width] duration-500"
              style={{ width: `${viewRole === "all" ? overall.pct : focus?.pct ?? 0}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <button
          type="button"
          onClick={() => setViewRole("all")}
          className={`rounded-xl border px-3 py-2 text-left ${
            viewRole === "all" ? "border-(--teal) bg-(--teal) text-white" : "border-stone-200 bg-white"
          }`}
        >
          <p className="text-[11px] opacity-80">관리자</p>
          <p className="font-semibold">전체</p>
          <p className="text-xs">{overall.pct}%</p>
        </button>
        {deptCards.map((d) => {
          const active = viewRole === d.role.id;
          return (
            <button
              key={d.role.id}
              type="button"
              onClick={() => setViewRole(d.role.id)}
              className={`rounded-xl border px-3 py-2 text-left ${
                active ? "border-(--teal) bg-(--teal) text-white" : "border-stone-200 bg-white hover:border-(--teal)"
              }`}
            >
              <p className="text-[11px] opacity-80">{d.done}/{d.total}</p>
              <p className="font-semibold leading-tight">{d.role.label.replace("·", " ")}</p>
              {d.left ? (
                <p className={`text-xs ${active ? "text-white/90" : ""}`}>
                  <span className={active ? "text-white" : "text-teal-700"}>완료 {d.done}</span>
                  <span className={`ml-1.5 ${active ? "text-amber-100" : "text-amber-800"}`}>미완료 {d.left}</span>
                </p>
              ) : (
                <p className={`text-xs ${active ? "text-white/80" : "text-teal-700"}`}>완료 {d.done}</p>
              )}
            </button>
          );
        })}
      </div>

      <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
        {filtered.map(({ i, all, mine }) => {
          const s = mine ?? all;
          return (
            <Link
              key={i.id}
              href={`/indicators/${i.id}`}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-stone-50"
            >
              <span className="w-7 shrink-0 text-right text-xs font-semibold text-(--teal)">{i.id}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm">{i.name}</span>
                  <span className={`shrink-0 text-xs font-semibold ${s.complete ? "text-teal-700" : ""}`}>
                    {s.complete ? (
                      <span className="text-teal-700">완료 {s.done}</span>
                    ) : (
                      <>
                        <span className="text-teal-700">완료 {s.done}</span>
                        <span className="ml-1.5 text-amber-800">미완료 {s.left}</span>
                      </>
                    )}
                  </span>
                </span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-stone-200">
                  <span
                    className={`block h-full rounded-full ${s.complete ? "bg-teal-600" : "bg-(--teal)"}`}
                    style={{ width: `${s.total ? (s.done / s.total) * 100 : 0}%` }}
                  />
                </span>
              </span>
            </Link>
          );
        })}
      </div>
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
    return (
      <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-800">완료 {done}</span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-800">완료 {done}</span>
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">미완료 {left}</span>
    </span>
  );
}

export function IndicatorProgressBadge({ indicator }: { indicator: Indicator }) {
  const { statsFor, viewRole } = useProgress();
  const s = statsFor(indicator, viewRole);
  if (!s.total) return null;
  return <ProgressCounts done={s.done} left={s.left} complete={s.complete} />;
}

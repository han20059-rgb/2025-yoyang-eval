"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { duties, periods, roles, type PeriodId, type RoleId } from "@/data/duties";

type View = "period" | "role";

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm ${
        active ? "bg-(--teal) text-white" : "border border-stone-200 bg-white text-stone-600 hover:border-(--teal)"
      }`}
    >
      {children}
    </button>
  );
}

function DutyCard({
  title,
  how,
  indicator,
  extra,
}: {
  title: string;
  how: string;
  indicator: number;
  extra?: string;
}) {
  return (
    <article className="rounded-xl border border-(--line) bg-(--card) p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="font-semibold text-stone-900">{title}</h4>
        <Link
          href={`/indicators/${indicator}`}
          className="shrink-0 rounded-full bg-(--teal-soft) px-2.5 py-0.5 text-xs font-medium text-(--teal)"
        >
          지표 {indicator}
        </Link>
      </div>
      {extra ? <p className="mt-1 text-xs text-stone-500">{extra}</p> : null}
      <p className="mt-2 text-sm leading-relaxed text-stone-700">{how}</p>
    </article>
  );
}

export function DutyBoard() {
  const [view, setView] = useState<View>("period");
  const [period, setPeriod] = useState<PeriodId | "all">("all");
  const [role, setRole] = useState<RoleId | "all">("all");

  const filtered = useMemo(() => {
    return duties.filter((d) => {
      if (period !== "all" && d.period !== period) return false;
      if (role !== "all" && !d.roles.includes(role) && !d.roles.includes("all")) return false;
      return true;
    });
  }, [period, role]);

  const groups = useMemo(() => {
    if (view === "period") {
      return periods
        .filter((p) => period === "all" || p.id === period)
        .map((p) => ({
          key: p.id,
          title: `${p.label} · ${p.hint}`,
          items: filtered.filter((d) => d.period === p.id),
        }))
        .filter((g) => g.items.length > 0);
    }
    return roles
      .filter((r) => role === "all" || r.id === role)
      .map((r) => ({
        key: r.id,
        title: r.label,
        items: filtered.filter((d) => {
          if (r.id === "all") return d.roles.includes("all");
          if (role === "all") return d.roles.includes(r.id);
          return d.roles.includes(r.id) || d.roles.includes("all");
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [filtered, period, role, view]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-(--teal)">현장에서 바로 쓰는 일정</p>
          <h2 className="text-xl font-bold">해야 할 일</h2>
          <p className="mt-1 max-w-2xl text-sm text-stone-600">
            매뉴얼에 주기가 적힌 일만 모았습니다. 주기와 직종을 같이 고를 수 있습니다.
          </p>
        </div>
        <div className="flex rounded-full border border-stone-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setView("period")}
            className={`rounded-full px-4 py-1.5 text-sm ${view === "period" ? "bg-(--teal) text-white" : "text-stone-600"}`}
          >
            주기로
          </button>
          <button
            type="button"
            onClick={() => setView("role")}
            className={`rounded-full px-4 py-1.5 text-sm ${view === "role" ? "bg-(--teal) text-white" : "text-stone-600"}`}
          >
            직종으로
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-stone-500">{view === "period" ? "주기" : "직종"}</p>
        <div className="flex flex-wrap gap-1.5">
          <Chip
            active={view === "period" ? period === "all" : role === "all"}
            onClick={() => (view === "period" ? setPeriod("all") : setRole("all"))}
          >
            전체
          </Chip>
          {view === "period"
            ? periods.map((p) => (
                <Chip key={p.id} active={period === p.id} onClick={() => setPeriod(p.id)}>
                  {p.label}
                </Chip>
              ))
            : roles.map((r) => (
                <Chip key={r.id} active={role === r.id} onClick={() => setRole(r.id)}>
                  {r.label}
                </Chip>
              ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-stone-500">{view === "period" ? "직종만 보기" : "주기만 보기"}</p>
        <div className="flex flex-wrap gap-1.5">
          {view === "period" ? (
            <>
              <Chip active={role === "all"} onClick={() => setRole("all")}>
                모든 직종
              </Chip>
              {roles
                .filter((r) => r.id !== "all")
                .map((r) => (
                  <Chip key={r.id} active={role === r.id} onClick={() => setRole(r.id)}>
                    {r.label}
                  </Chip>
                ))}
            </>
          ) : (
            <>
              <Chip active={period === "all"} onClick={() => setPeriod("all")}>
                모든 주기
              </Chip>
              {periods.map((p) => (
                <Chip key={p.id} active={period === p.id} onClick={() => setPeriod(p.id)}>
                  {p.label}
                </Chip>
              ))}
            </>
          )}
        </div>
      </div>

      <p className="text-xs text-stone-500">{filtered.length}건 · 카드의 지표 번호를 누르면 원문을 봅니다.</p>

      {groups.map((g) => (
        <div key={g.key} className="space-y-2">
          <h3 className="text-sm font-semibold text-(--teal)">{g.title}</h3>
          <div className="grid gap-2 md:grid-cols-2">
            {g.items.map((d) => (
              <DutyCard
                key={`${g.key}-${d.indicator}-${d.title}`}
                title={d.title}
                how={d.how}
                indicator={d.indicator}
                extra={
                  view === "period"
                    ? roles
                        .filter((r) => d.roles.includes(r.id))
                        .map((r) => r.label)
                        .join(" · ")
                    : `${periods.find((p) => p.id === d.period)?.label}`
                }
              />
            ))}
          </div>
        </div>
      ))}

      {groups.length === 0 ? <p className="text-sm text-stone-500">선택한 조건에 해당하는 일이 없습니다.</p> : null}
    </section>
  );
}

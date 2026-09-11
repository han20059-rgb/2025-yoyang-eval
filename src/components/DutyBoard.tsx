"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ProgressCounts } from "@/components/ProgressBoard";
import { useProgress } from "@/components/ProgressProvider";
import { duties, periods, roles, type PeriodId } from "@/data/duties";
import type { Indicator } from "@/lib/types";

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

export function DutyBoard({ indicators }: { indicators: Indicator[] }) {
  const { viewRole, setViewRole, statsFor } = useProgress();
  const [period, setPeriod] = useState<PeriodId | "all">("all");
  const role = viewRole;
  const byId = useMemo(() => new Map(indicators.map((i) => [i.id, i])), [indicators]);

  const filtered = useMemo(() => {
    return duties.filter((d) => {
      if (period !== "all" && d.period !== period) return false;
      if (role !== "all" && !d.roles.includes(role) && !d.roles.includes("all")) return false;
      return true;
    });
  }, [period, role]);

  const groups = useMemo(() => {
    return periods
      .filter((p) => period === "all" || p.id === period)
      .map((p) => ({
        key: p.id,
        title: `${p.label} · ${p.hint}`,
        items: filtered.filter((d) => d.period === p.id),
      }))
      .filter((g) => g.items.length > 0);
  }, [filtered, period]);

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-medium tracking-wide text-(--teal)">현장에서 바로 쓰는 일정</p>
        <h2 className="text-xl font-bold">해야 할 일</h2>
        <p className="mt-1 max-w-2xl text-sm text-stone-600">
          매뉴얼에 주기가 적힌 일만 모았습니다. 직종을 고르면 위 준비 현황과 같이 움직입니다.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-stone-500">주기</p>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={period === "all"} onClick={() => setPeriod("all")}>
            전체
          </Chip>
          {periods.map((p) => (
            <Chip key={p.id} active={period === p.id} onClick={() => setPeriod(p.id)}>
              {p.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-stone-500">직종</p>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={role === "all"} onClick={() => setViewRole("all")}>
            모든 직종
          </Chip>
          {roles
            .filter((r) => r.id !== "all")
            .map((r) => (
              <Chip key={r.id} active={role === r.id} onClick={() => setViewRole(r.id)}>
                {r.label}
              </Chip>
            ))}
        </div>
      </div>

      <p className="text-xs text-stone-500">{filtered.length}건 · 카드의 지표 번호를 누르면 원문을 봅니다.</p>

      {groups.map((g) => (
        <div key={g.key} className="space-y-2">
          <h3 className="text-sm font-semibold text-(--teal)">{g.title}</h3>
          <div className="grid gap-2 md:grid-cols-2">
            {g.items.map((d) => {
              const ind = byId.get(d.indicator);
              const s = ind ? statsFor(ind, role) : null;
              return (
                <article key={`${g.key}-${d.indicator}-${d.title}`} className="rounded-xl border border-(--line) bg-(--card) p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h4 className="font-semibold text-stone-900">{d.title}</h4>
                    <div className="flex items-center gap-1.5">
                      {s && s.total > 0 ? (
                        <ProgressCounts done={s.done} left={s.left} complete={s.complete} />
                      ) : null}
                      <Link
                        href={`/indicators/${d.indicator}`}
                        className="shrink-0 rounded-full bg-(--teal-soft) px-2.5 py-0.5 text-xs font-medium text-(--teal)"
                      >
                        지표 {d.indicator}
                      </Link>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-stone-500">
                    {roles
                      .filter((r) => d.roles.includes(r.id))
                      .map((r) => r.label)
                      .join(" · ")}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-stone-700">{d.how}</p>
                </article>
              );
            })}
          </div>
        </div>
      ))}

      {groups.length === 0 ? <p className="text-sm text-stone-500">선택한 조건에 해당하는 일이 없습니다.</p> : null}
    </section>
  );
}

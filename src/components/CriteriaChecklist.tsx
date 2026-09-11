"use client";

import { MethodChips, MethodText } from "@/components/MethodText";
import { ProgressCounts } from "@/components/ProgressBoard";
import { useProgress } from "@/components/ProgressProvider";
import { roles } from "@/data/duties";
import { parseEvalCriteria, roleShort, rolesForIndicator } from "@/lib/evalCriteria";
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
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
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
  const { isChecked, toggle, statsFor, viewRole } = useProgress();
  const items = parseEvalCriteria(indicator.curr.criteria);
  const dept = rolesForIndicator(indicator.id);
  const stat = statsFor(indicator, "all");
  const mine = viewRole === "all" ? null : statsFor(indicator, viewRole);

  if (items.length === 0) {
    return <MethodText text={indicator.curr.criteria} query={query} emphasize />;
  }

  return (
    <div className="space-y-3">
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

      {items.map((it, idx) => {
        const row = stat.items[idx];
        return (
          <article
            key={it.mark}
            className={`rounded-xl border px-3 py-3 ${
              row?.complete ? "border-teal-200 bg-teal-50/40" : "border-stone-200 bg-white"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <span className="text-lg font-bold text-(--teal)">{it.mark}</span>
                <MethodChips methods={it.methods} pulse />
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
            <div className="mt-2">
              <MethodText text={it.text} query={query} emphasize />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {dept.map((r) => {
                const dim = viewRole !== "all" && r !== viewRole && r !== "all";
                return (
                  <DeptCheck
                    key={r}
                    checked={isChecked(indicator.id, it.mark, r)}
                    label={roleShort[r]}
                    dim={dim}
                    onToggle={() => toggle(indicator.id, it.mark, r)}
                  />
                );
              })}
            </div>
          </article>
        );
      })}
    </div>
  );
}

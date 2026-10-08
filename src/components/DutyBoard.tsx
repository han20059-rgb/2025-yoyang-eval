"use client";

import { useEffect, useMemo, useState } from "react";
import { useEvalSession } from "@/components/EvalSession";
import { useProgress } from "@/components/ProgressProvider";
import { useAssignments } from "@/components/AssignmentProvider";
import { duties, periods, roles, type PeriodId } from "@/data/duties";
import { parseEvalCriteria, criterionEvidence, rolePreparesDuty } from "@/lib/evalCriteria";
import type { Indicator } from "@/lib/types";

export function DutyBoard({ indicators }: { indicators: Indicator[] }) {
  const { mode, identity } = useEvalSession();
  const { viewRole, setViewRole } = useProgress();
  const { adminRoles } = useAssignments();
  const [period, setPeriod] = useState<PeriodId | "all">("daily");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("eval-duty-ui");
    if (!raw) return;
    try {
      const s = JSON.parse(raw) as { period?: PeriodId; open?: string; scroll?: number; viewRole?: string };
      if (s.period) setPeriod(s.period);
      if (s.open) setOpen(s.open);
      if (s.viewRole) setViewRole(s.viewRole as typeof viewRole);
      if (s.scroll) window.scrollTo(0, s.scroll);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem("eval-duty-ui", JSON.stringify({ period, open, scroll: window.scrollY, viewRole }));
  }, [period, open, viewRole]);

  useEffect(() => {
    if (identity?.evalRole && viewRole === "all" && mode !== "anon") setViewRole(identity.evalRole);
  }, [identity, mode, setViewRole, viewRole]);

  const role = viewRole;
  const filtered = useMemo(() => {
    return duties.filter((d) => {
      if (period !== "all" && d.period !== period) return false;
      const ind = indicators.find((i) => i.id === d.indicator);
      if (rolePreparesDuty(d, role, ind?.curr.criteria, ind?.curr.method)) return true;
      const items = parseEvalCriteria(ind?.curr.criteria || "");
      return items.some((it) => adminRoles(d.indicator, it.mark).includes(role));
    });
  }, [period, role, indicators, adminRoles]);

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-medium tracking-wide text-(--teal)">현장에서 바로 쓰는 일정</p>
        <h2 className="text-xl font-bold">해야 할 일</h2>
        <p className="mt-1 text-sm text-stone-600">내 직종을 고른 뒤 주기를 고르세요. 지표 준비 완료와 이 목록의 수행은 다릅니다.</p>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-stone-500">직종</p>
        <div className="flex flex-col gap-1.5">
          {roles
            .filter((r) => r.id !== "all")
            .map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setViewRole(r.id)}
                className={`min-h-11 w-full rounded-xl border px-3 text-left text-[16px] ${
                  role === r.id ? "border-(--teal) bg-(--teal) text-white" : "border-stone-200 bg-white"
                }`}
              >
                {r.label}
              </button>
            ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-stone-500">주기</p>
        <div className="flex flex-col gap-1.5">
          {periods.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`min-h-11 w-full rounded-xl border px-3 text-left text-[16px] ${
                period === p.id ? "border-(--teal) bg-(--teal) text-white" : "border-stone-200 bg-white"
              }`}
            >
              {p.label} · {p.hint}
            </button>
          ))}
        </div>
      </div>
      <ul className="space-y-2">
        {filtered.map((d) => {
          const key = `${d.period}-${d.indicator}-${d.title}`;
          const opened = open === key;
          const freq = periods.find((p) => p.id === d.period)?.hint || "";
          return (
            <li key={key} className="rounded-xl border border-(--line) bg-(--card)">
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-3 text-left"
                onClick={() => setOpen(opened ? null : key)}
              >
                <span className="text-[16px] font-semibold leading-6">{d.title}</span>
                <span className="shrink-0 text-sm text-stone-500">{freq} · {opened ? "접기" : "펼치기"}</span>
              </button>
              {opened ? (
                <div className="space-y-2 border-t border-stone-100 px-3 py-3 text-[16px] leading-7">
                  <p>{d.how}</p>
                  <p className="text-sm text-stone-500">해야 할 내용·남길 기록·주의는 원문을 따릅니다. 업무 수행 완료와 평가 준비 완료는 다릅니다.</p>
                  {(() => {
                    const ind = indicators.find((i) => i.id === d.indicator);
                    const loc = `지표 ${d.indicator} · ${ind?.name || d.title}${d.mark ? ` 기준 ${d.mark}` : ""} · 파일 ${ind?.fullSource?.filePages?.[0] ?? ind?.pages?.[0] ?? "?"}쪽`;
                    const ev = criterionEvidence(d.indicator, d.mark || "①", `${d.title}. ${d.how}\n${ind?.curr.criteria || ""}`, loc).filter((e) => e.role === role);
                    return ev.length ? (
                      <div className="rounded-lg bg-teal-50 px-2 py-2 text-[15px] leading-7">
                        <p className="text-[13px] font-semibold text-teal-800">담당 근거</p>
                        <p>{ev[0].quote}</p>
                        <p className="text-sm text-stone-600">{ev[0].loc}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-amber-800">이 업무는 원문에 수행 주체가 없어 내 직종 담당으로 확정하지 않습니다.</p>
                    );
                  })()}
                  <a
                    className="inline-flex min-h-11 items-center text-(--teal) underline"
                    href={`/indicators/${d.indicator}${d.mark ? `#crit-${d.indicator}-${d.mark}` : "#checklist"}`}
                    onClick={(e) => {
                      sessionStorage.setItem(
                        "eval-duty-ui",
                        JSON.stringify({ period, open: key, scroll: window.scrollY, viewRole: role })
                      );
                      e.preventDefault();
                      const hash = d.mark ? `crit-${d.indicator}-${d.mark}` : "checklist";
                      window.location.assign(`/indicators/${d.indicator}#${hash}`);
                    }}
                  >
                    관련 평가기준 보기 (지표 {d.indicator}
                    {d.mark ? ` 기준 ${d.mark}` : ""})
                  </a>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {filtered.length === 0 ? <p className="text-sm text-stone-500">선택한 직종·주기에 해당하는 일이 없습니다.</p> : null}
      <p className="hidden">{indicators.length}</p>
    </section>
  );
}

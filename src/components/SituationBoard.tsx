"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AssignPicker, type DirStaff } from "@/components/AssignPicker";
import { IndicatorSourcePanel } from "@/components/IndicatorSourcePanel";
import { useAssignments } from "@/components/AssignmentProvider";
import { useEvalSession } from "@/components/EvalSession";
import { useProgress } from "@/components/ProgressProvider";
import { adminFetch } from "@/lib/adminClient";
import {
  assigneeGroups,
  assigneeSummary,
  buildSitRows,
  matchesFilter,
  mineRows,
  sitCounts,
  sitProblemScore,
  type SitFilter,
  type SitRow,
} from "@/lib/situation";
import type { Indicator } from "@/lib/types";

const UI_KEY = "eval-sit-ui";
const PAGE = 12;
const DEMO_STAFF = [
  { id: 101, name: "김간호", jobType: "간호사" },
  { id: 102, name: "이사회", jobType: "사회복지사" },
  { id: 103, name: "박요양", jobType: "요양보호사" },
];

export function SituationBoard({ indicators }: { indicators: Indicator[] }) {
  const { mode, identity } = useEvalSession();
  const { map, reload, storage } = useAssignments();
  const { checks, needsRecheck, saveStatus, saveMessage } = useProgress();
  const isAdmin = Boolean(identity?.isAdmin);
  const [view, setView] = useState<"indicator" | "assignee">("indicator");
  const [filter, setFilter] = useState<SitFilter | "all">("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [assigneeKey, setAssigneeKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [staffDir, setStaffDir] = useState<DirStaff[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const restored = useRef(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(UI_KEY);
    if (!raw) return;
    try {
      const s = JSON.parse(raw) as { view?: typeof view; filter?: typeof filter; q?: string; page?: number; selected?: string; scroll?: number };
      if (s.view) setView(s.view);
      if (s.filter) setFilter(s.filter);
      if (s.q) setQ(s.q);
      if (s.page) setPage(s.page);
      if (s.selected) setSelected(s.selected);
      if (typeof s.scroll === "number") window.setTimeout(() => window.scrollTo(0, s.scroll || 0), 50);
    } catch {
      /* ignore */
    }
    restored.current = true;
  }, []);

  useEffect(() => {
    if (!restored.current && !selected) return;
    sessionStorage.setItem(UI_KEY, JSON.stringify({ view, filter, q, page, selected, scroll: window.scrollY }));
  }, [view, filter, q, page, selected]);

  useEffect(() => {
    if (mode === "demo") {
      setStaffDir(DEMO_STAFF.map((s) => ({ leaveRecordId: s.id, name: s.name, jobType: s.jobType })));
      return;
    }
    if (isAdmin) {
      void adminFetch("/api/admin/staff").then(async (res) => {
        const data = await res.json().catch(() => ({}));
        setStaffDir((data.items || []) as DirStaff[]);
      });
    }
  }, [mode, isAdmin]);

  const rows = useMemo(
    () =>
      mineRows(
        buildSitRows(indicators, map, checks, needsRecheck),
        identity?.evalRole,
        identity?.leaveRecordId || 0,
        isAdmin || mode === "anon"
      ),
    [indicators, map, checks, needsRecheck, identity, isAdmin, mode]
  );
  const counts = sitCounts(rows);
  const filtered = rows.filter((r) => {
    if (!matchesFilter(r, filter)) return false;
    if (!q.trim()) return true;
    const blob = `${r.indicatorId} ${r.name} ${r.mark} ${r.text} ${assigneeSummary(r)}`.toLowerCase();
    return blob.includes(q.trim().toLowerCase());
  });

  const byInd = useMemo(() => {
    const m = new Map<number, SitRow[]>();
    for (const r of [...filtered].sort((a, b) => sitProblemScore(a) - sitProblemScore(b) || a.indicatorId - b.indicatorId)) {
      const list = m.get(r.indicatorId) || [];
      list.push(r);
      m.set(r.indicatorId, list);
    }
    return [...m.entries()].sort((a, b) => {
      const pa = Math.min(...a[1].map(sitProblemScore));
      const pb = Math.min(...b[1].map(sitProblemScore));
      return pa - pb || a[0] - b[0];
    });
  }, [filtered]);

  const pages = Math.max(1, Math.ceil(byInd.length / PAGE));
  const slice = byInd.slice(page * PAGE, page * PAGE + PAGE);
  const groups = useMemo(() => assigneeGroups(filtered), [filtered]);
  const selectedRow = rows.find((r) => r.key === selected) || null;
  const selectedInd = selectedRow ? indicators.find((i) => i.id === selectedRow.indicatorId) : null;

  function openRow(key: string) {
    sessionStorage.setItem(UI_KEY, JSON.stringify({ view, filter, q, page, selected: key, scroll: window.scrollY }));
    setSelected(key);
  }

  function closeDetail() {
    const raw = sessionStorage.getItem(UI_KEY);
    setSelected(null);
    try {
      const s = raw ? (JSON.parse(raw) as { scroll?: number; page?: number }) : {};
      if (typeof s.page === "number") setPage(s.page);
      window.setTimeout(() => window.scrollTo(0, s.scroll || 0), 30);
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="space-y-4">
      <div className={selected ? "max-lg:hidden" : ""}>
        <p className="text-xs text-(--teal)">평가 준비</p>
        <h2 className="text-xl font-bold">평가 준비 상황판</h2>
        <p className="mt-1 text-[15px] leading-7 text-stone-600">
          문제 항목을 고른 뒤 원문과 담당을 확인합니다. 준비 완료는 평가점수가 아닙니다.
          {mode === "demo" ? " 시연은 메모리만 사용합니다." : ` 저장소: ${storage}`}
        </p>
        {saveMessage ? <p className="text-sm text-stone-500">{saveMessage}{saveStatus === "saving" ? " · 저장 중" : saveStatus === "saved" ? " · 저장됨" : saveStatus === "failed" ? " · 저장 실패" : ""}</p> : null}
      </div>
      <div className={`grid grid-cols-2 gap-2 sm:grid-cols-4 ${selected ? "max-lg:hidden" : ""}`}>
        {(
          [
            ["done", "준비 완료", counts.done],
            ["open", "미완료", counts.open],
            ["unassigned", "담당 미지정", counts.unassigned],
            ["recheck", "재확인 필요", counts.recheck],
          ] as const
        ).map(([id, label, n]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setFilter(filter === id ? "all" : id);
              setPage(0);
            }}
            className={`min-h-14 rounded-2xl border px-3 py-2 text-left ${filter === id ? "border-(--teal) bg-(--teal-soft)" : "border-(--line) bg-(--card)"}`}
          >
            <span className="block text-xs text-stone-500">{label}</span>
            <span className="text-2xl font-bold">{n}</span>
          </button>
        ))}
      </div>
      <p className={`text-xs leading-5 text-stone-500 ${selected ? "max-lg:hidden" : ""}`}>미지정·재확인은 미완료와 겹칠 수 있어 네 숫자를 합하지 않습니다. 기준 수 {counts.all}.</p>
      <div className={`flex flex-col gap-2 sm:flex-row ${selected ? "max-lg:hidden" : ""}`}>
        <div className="grid grid-cols-2 gap-2 sm:w-56">
          <button type="button" className={`min-h-11 rounded-xl border ${view === "indicator" ? "border-(--teal) bg-(--teal-soft)" : "border-stone-200 bg-white"}`} onClick={() => setView("indicator")}>
            지표별
          </button>
          <button type="button" className={`min-h-11 rounded-xl border ${view === "assignee" ? "border-(--teal) bg-(--teal-soft)" : "border-stone-200 bg-white"}`} onClick={() => setView("assignee")}>
            담당별
          </button>
        </div>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          placeholder="지표·담당 검색"
          className="min-h-11 flex-1 rounded-xl border border-stone-200 bg-white px-3 text-[16px]"
        />
      </div>
      <div className="lg:grid lg:grid-cols-2 lg:gap-4">
        <div ref={listRef} className={selected ? "max-lg:hidden" : ""}>
          {view === "indicator" ? (
            <div className="space-y-2">
              {slice.map(([id, list]) => {
                const first = list[0];
                const left = list.filter((r) => !r.done).length;
                const people = [...new Set(list.flatMap((r) => (r.assigned ? [assigneeSummary(r)] : ["미지정"])))];
                return (
                  <article key={id} className="rounded-2xl border border-(--line) bg-(--card) px-3 py-3">
                    <button type="button" className="min-h-11 w-full text-left" onClick={() => setExpanded(expanded === String(id) ? null : String(id))}>
                      <p className="text-[16px] font-semibold leading-6">
                        {id}. {first.name}
                      </p>
                      <p className="mt-1 text-[14px] leading-6 text-stone-600">
                        남은 기준 {left} · {people.slice(0, 2).join(", ")}
                        {people.length > 2 ? ` 외 ${people.length - 2}` : ""}
                      </p>
                    </button>
                    {expanded === String(id) || list.length <= 3 ? (
                      <ul className="mt-2 space-y-1">
                        {list.map((r) => (
                          <li key={r.key}>
                            <button type="button" className="min-h-11 w-full rounded-xl px-2 py-2 text-left text-[15px] leading-6 hover:bg-stone-50" onClick={() => openRow(r.key)}>
                              {r.mark} {r.done ? "준비됨" : r.assigned ? "미완료" : "미지정"}
                              {r.recheck ? " · 재확인" : ""} · {assigneeSummary(r)}
                            </button>
                            {isAdmin || mode === "demo" ? (
                              <AssignPicker
                                compact={!r.assigned}
                                indicatorId={r.indicatorId}
                                mark={r.mark}
                                manual={r.manual}
                                currentRoles={r.combined.map((c) => c.role)}
                                currentStaff={r.staff}
                                recheckRoles={r.recheckRoles}
                                staffDir={staffDir}
                                onSaved={() => reload()}
                              />
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                );
              })}
              <div className="flex gap-2">
                <button type="button" className="min-h-11 flex-1 rounded-xl border bg-white" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                  이전
                </button>
                <p className="flex min-h-11 items-center px-2 text-sm">{page + 1}/{pages}</p>
                <button type="button" className="min-h-11 flex-1 rounded-xl border bg-white" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
                  더 보기
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map((g) => (
                <article key={g.key} className="rounded-2xl border border-(--line) bg-(--card) px-3 py-3">
                  <button type="button" className="min-h-11 w-full text-left" onClick={() => setAssigneeKey(assigneeKey === g.key ? null : g.key)}>
                    <p className="text-[16px] font-semibold">{g.label}</p>
                    <p className="text-[14px] leading-6 text-stone-600">
                      기준 {g.total} · 미완료 {g.open} · 재확인 {g.recheck}
                    </p>
                  </button>
                  {assigneeKey === g.key ? (
                    <ul className="mt-2 space-y-1">
                      {g.rows.map((r) => (
                        <li key={r.key}>
                          <button type="button" className="min-h-11 w-full rounded-xl px-2 text-left text-[15px] leading-6" onClick={() => openRow(r.key)}>
                            {r.indicatorId}. {r.mark} {r.done ? "준비됨" : "미완료"}
                            {r.recheck ? " · 재확인" : ""}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </div>
        {selectedRow && selectedInd ? (
          <SituationDetail row={selectedRow} indicator={selectedInd} onClose={closeDetail} />
        ) : (
          <p className="hidden rounded-2xl border border-dashed border-stone-300 p-4 text-sm text-stone-500 lg:block">항목을 선택하면 기준·담당·원문·지시가 여기에 열립니다.</p>
        )}
      </div>
    </section>
  );
}

function SituationDetail({
  row,
  indicator,
  onClose,
}: {
  row: SitRow;
  indicator: Indicator;
  onClose: () => void;
}) {
  const source = indicator.fullSource;
  return (
    <div className="max-h-[calc(100vh-5rem)] space-y-4 overflow-y-auto rounded-2xl border border-(--line) bg-(--card) p-4 lg:sticky lg:top-4">
      <button type="button" className="min-h-11 rounded-xl border bg-white px-3" onClick={onClose}>
        목록으로
      </button>
      <p className="text-[15px] leading-6 text-stone-600">
        {row.indicatorId}. {row.mark} {indicator.name} · {row.done ? "준비 완료" : row.assigned ? "미완료" : "담당 미지정"}
        {row.recheck ? " · 재확인 필요" : ""}
      </p>
      {source ? (
        <IndicatorSourcePanel full={source} indicator={indicator} focusMark={row.mark} />
      ) : (
        <p className="whitespace-pre-wrap text-[15px] leading-7">{indicator.curr.criteria}</p>
      )}
      <Link className="inline-flex min-h-11 items-center text-(--teal) underline" href={`/indicators/${row.indicatorId}#crit-${row.indicatorId}-${row.mark}`}>
        지표 페이지에서 이 기준 보기
      </Link>
    </div>
  );
}

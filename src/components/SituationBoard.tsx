"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useClientReady } from "@/lib/useClientReady";
import { useAssignments } from "@/components/AssignmentProvider";
import { useEvalSession } from "@/components/EvalSession";
import { useProgress } from "@/components/ProgressProvider";
import { useStaffDirectory } from "@/components/useStaffDirectory";
import { EvalBadges } from "@/components/EvalBadges";
import {
  assigneeGroups,
  assigneePreview,
  buildSitIndicatorCards,
  buildSitRows,
  matchesIndicatorFilter,
  mineRows,
  sitIndicatorCounts,
  type SitFilter,
  type SitIndicatorCard,
} from "@/lib/situation";
import type { Indicator } from "@/lib/types";

const UI_KEY = "eval-sit-ui";

type BoardFilter = SitFilter | "progress" | "all";

function statusStyle(status: SitIndicatorCard["status"]) {
  if (status === "done") return { box: "border-emerald-300 bg-emerald-50", label: "완료", text: "text-emerald-900" };
  if (status === "progress") return { box: "border-amber-300 bg-amber-50", label: "진행 중", text: "text-amber-950" };
  return { box: "border-stone-300 bg-stone-100", label: "미완료", text: "text-stone-800" };
}

function IndicatorSitCard({ card }: { card: SitIndicatorCard }) {
  const st = statusStyle(card.status);
  return (
    <Link
      href={`/indicators/${card.id}`}
      onClick={() => {
        try {
          const raw = sessionStorage.getItem(UI_KEY);
          const prev = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
          sessionStorage.setItem(UI_KEY, JSON.stringify({ ...prev, scroll: window.scrollY }));
        } catch {
          /* ignore */
        }
      }}
      className={`block rounded-xl border px-2.5 py-2 ${st.box}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 text-[15px] font-bold leading-5">
          {card.id}. {card.name}
        </h3>
        <span className="shrink-0 text-[13px] font-semibold text-stone-700">원문 {card.score}점</span>
      </div>
      <div className="mt-1 min-w-0">
        <EvalBadges changeKind={card.changeKind} methods={card.methods} />
      </div>
      <p className={`mt-1 text-[13px] font-semibold leading-5 ${st.text}`}>
        {st.label}
        <span className="ml-1 font-medium text-stone-700">
          준비 {card.doneMarks}/{card.totalMarks}기준
        </span>
      </p>
      {card.assignees.length ? <p className="mt-0.5 truncate text-[13px] leading-5 text-stone-700">{assigneePreview(card.assignees)}</p> : null}
      <div className="mt-1 flex flex-wrap gap-1">
        {card.unassigned ? <span className="rounded bg-white px-1.5 text-[12px] leading-5 text-stone-700">담당 미지정</span> : null}
        {card.recheck ? <span className="rounded bg-white px-1.5 text-[12px] leading-5 text-amber-900">재확인 필요</span> : null}
      </div>
    </Link>
  );
}

export function SituationBoard({ indicators }: { indicators: Indicator[] }) {
  const { mode, identity } = useEvalSession();
  const { map } = useAssignments();
  const { checks, needsRecheck, saveStatus, saveMessage } = useProgress();
  const sessionReady = useClientReady();
  const isAdmin = Boolean(sessionReady && identity?.isAdmin);
  const [view, setView] = useState<"indicator" | "assignee">("indicator");
  const [filter, setFilter] = useState<BoardFilter>("all");
  const [q, setQ] = useState("");
  const staffDirState = useStaffDirectory(isAdmin && mode !== "demo");
  const restored = useRef(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(UI_KEY);
    if (!raw) {
      restored.current = true;
      return;
    }
    try {
      const s = JSON.parse(raw) as { view?: typeof view; filter?: BoardFilter; q?: string; scroll?: number };
      queueMicrotask(() => {
        if (s.view) setView(s.view);
        if (s.filter) setFilter(s.filter);
        if (s.q) setQ(s.q);
      });
      if (typeof s.scroll === "number") window.setTimeout(() => window.scrollTo(0, s.scroll || 0), 50);
    } catch {
      /* ignore */
    }
    restored.current = true;
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    sessionStorage.setItem(UI_KEY, JSON.stringify({ view, filter, q, scroll: window.scrollY }));
  }, [view, filter, q]);

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
  const cards = useMemo(() => buildSitIndicatorCards(rows, indicators), [rows, indicators]);
  const counts = sitIndicatorCounts(cards);
  const filtered = cards.filter((c) => {
    if (!matchesIndicatorFilter(c, filter)) return false;
    if (!q.trim()) return true;
    const blob = `${c.id} ${c.name} ${c.assignees.join(" ")}`.toLowerCase();
    return blob.includes(q.trim().toLowerCase());
  });
  const groups = useMemo(() => assigneeGroups(rows), [rows]);

  return (
    <section className="space-y-3">
      <div>
        <p className="text-xs text-(--teal)">평가 준비</p>
        <h2 className="text-xl font-bold">평가 준비 상황판</h2>
        <p className="mt-1 text-[15px] leading-6 text-stone-600">
          지표 제목·배점·담당·준비 상태를 보고, 내용은 지표 상세에서 확인하고 수정합니다. 준비 완료는 평가점수가 아닙니다.
          {mode === "demo" ? " 시연은 이 기기에만 잠시 남고, 서버에는 저장되지 않습니다." : isAdmin ? " 저장하면 기관 담당 자료에 반영됩니다." : ""}
        </p>
        {saveMessage ? (
          <p className="text-sm text-stone-500">
            {saveMessage}
            {saveStatus === "saving" ? " · 저장 중" : saveStatus === "saved" ? " · 저장됨" : saveStatus === "failed" ? " · 저장 실패" : ""}
          </p>
        ) : null}
        {saveStatus === "failed" ? <p className="text-sm text-amber-800">준비 상태 저장에 실패했습니다. 0건으로 보이지 않습니다.</p> : null}
        {staffDirState.error ? <p className="text-sm text-amber-800">담당 명단 조회 오류: {staffDirState.error}</p> : null}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {(
          [
            ["done", "준비 완료", counts.done, "지표"],
            ["progress", "진행 중", counts.progress, "지표"],
            ["open", "미완료", counts.open, "지표"],
            ["unassigned", "담당 미지정", counts.unassigned, "지표"],
            ["recheck", "재확인 필요", counts.recheck, "지표"],
          ] as const
        ).map(([id, label, n, unit]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(filter === id ? "all" : id)}
            className={`min-h-14 rounded-xl border px-2 py-2 text-left ${filter === id ? "border-(--teal) bg-(--teal-soft)" : "border-(--line) bg-(--card)"}`}
          >
            <span className="block text-[11px] text-stone-500">{label}</span>
            <span className="text-xl font-bold">{n}</span>
            <span className="ml-0.5 text-[11px] text-stone-500">{unit}</span>
          </button>
        ))}
      </div>
      <p className="text-[12px] leading-5 text-stone-500">
        집계 단위는 지표입니다. 완료·진행 중·미완료는 겹치지 않습니다. 담당 미지정·재확인은 겹칠 수 있어 합하지 않습니다. 전체 {counts.all}지표.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
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
          onChange={(e) => setQ(e.target.value)}
          placeholder="지표·담당 검색"
          className="min-h-11 flex-1 rounded-xl border border-stone-200 bg-white px-3 text-[16px]"
        />
      </div>
      {view === "indicator" ? (
        <div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-2">
          {filtered.map((c) => (
            <IndicatorSitCard key={c.id} card={c} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const gCards = buildSitIndicatorCards(g.rows, indicators).filter((c) => matchesIndicatorFilter(c, filter));
            const shown = q.trim()
              ? gCards.filter((c) => `${c.id} ${c.name} ${g.label}`.toLowerCase().includes(q.trim().toLowerCase()))
              : gCards;
            if (!shown.length && q.trim()) return null;
            return (
              <div key={g.key}>
                <p className="mb-1 text-[14px] font-semibold">
                  {g.label}
                  <span className="ml-2 text-[13px] font-medium text-stone-500">지표 {shown.length}</span>
                </p>
                <div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-2">
                  {shown.map((c) => (
                    <IndicatorSitCard key={`${g.key}-${c.id}`} card={c} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!filtered.length && view === "indicator" ? <p className="text-[15px] text-stone-600">조건에 맞는 지표가 없습니다.</p> : null}
    </section>
  );
}

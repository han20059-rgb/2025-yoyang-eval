"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ManualText, extractPurpose, splitScoring } from "@/components/Highlight";
import { CriteriaChecklist } from "@/components/CriteriaChecklist";
import { MethodChips, MethodText } from "@/components/MethodText";
import { ProgressCounts } from "@/components/ProgressBoard";
import { useProgress } from "@/components/ProgressProvider";
import { parseEvalCriteria, uniqueMethods } from "@/lib/evalCriteria";
import type { Indicator, Side } from "@/lib/types";
import { searchIndicators } from "@/lib/search";
import { IndicatorSourcePanel } from "@/components/IndicatorSourcePanel";
import { LinkedWorkflows } from "@/components/LinkedWorkflows";
import { OriginalFiles } from "@/components/OriginalFiles";

const tabs = [
  { id: "now", label: "이번 평가", short: "이번" },
  { id: "prev", label: "이전 평가", short: "이전" },
  { id: "both", label: "나란히", short: "나란히" },
] as const;

function Section({
  kicker,
  title,
  aside,
  children,
}: {
  kicker?: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <header className="border-b border-stone-200 bg-stone-50 px-4 py-2">
        {kicker ? <p className="text-[11px] font-medium tracking-wide text-stone-500">{kicker}</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-(--teal)">{title}</h3>
          {aside}
        </div>
      </header>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

function SidePanel({
  year,
  side,
  query,
  prevForDiff,
  showDiffLegend,
  currIndicator,
  emphasizeMethods,
}: {
  year: string;
  side: Side;
  query?: string;
  prevForDiff?: string;
  showDiffLegend?: boolean;
  currIndicator?: Indicator;
  emphasizeMethods?: boolean;
}) {
  const { goal, purpose } = extractPurpose(side.intro);
  const scoring = splitScoring(side.criteria);
  const methodKinds = uniqueMethods(parseEvalCriteria(side.criteria).flatMap((c) => c.methods));

  return (
    <div className="min-w-0 space-y-3">
      <p className="text-xs font-semibold tracking-wide text-stone-500">{year}</p>
      {showDiffLegend ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          노란 배경·<b>달라짐</b> 표시는 이전 평가 본문에 없던 내용입니다.
        </p>
      ) : null}

      {(goal || purpose) && (
        <Section
          kicker="이 지표가 보려는 것"
          title="평가방향"
          aside={emphasizeMethods ? <MethodChips methods={methodKinds} pulse /> : null}
        >
          {goal ? (
            <p className="mb-2 font-medium text-stone-900">
              <ManualText text={goal} query={query} prevForDiff={prevForDiff} />
            </p>
          ) : null}
          {purpose ? <ManualText text={purpose} query={query} prevForDiff={prevForDiff} /> : null}
        </Section>
      )}

      <Section kicker="무엇을 충족해야 하는가" title="평가기준">
        {emphasizeMethods && currIndicator ? (
          <CriteriaChecklist indicator={currIndicator} query={query} />
        ) : emphasizeMethods ? (
          <MethodText text={scoring.body} query={query} emphasize />
        ) : (
          <ManualText text={scoring.body} query={query} prevForDiff={prevForDiff} />
        )}
      </Section>

      {scoring.scoring ? (
        <Section kicker="몇 점을 주는가" title="채점기준">
          {emphasizeMethods ? (
            <MethodText text={scoring.scoring} query={query} emphasize />
          ) : (
            <ManualText text={scoring.scoring} query={query} prevForDiff={prevForDiff} />
          )}
        </Section>
      ) : null}

      <Section kicker="언제부터 적용하는가" title="지표적용기간">
        <ManualText text={side.period || "본문에 별도 기간이 없으면 매뉴얼 일반사항(2022.1. ~ 2025년 평가일)을 따릅니다."} query={query} prevForDiff={prevForDiff} />
      </Section>

      <Section kicker="어떻게 확인하는가" title="확인방법">
        {emphasizeMethods ? (
          <MethodText text={side.method} query={query} emphasize />
        ) : (
          <ManualText text={side.method} query={query} prevForDiff={prevForDiff} />
        )}
      </Section>

      {side.law?.trim() ? (
        <Section kicker="법령·고시" title="관련근거">
          <ManualText text={side.law} query={query} prevForDiff={prevForDiff} />
        </Section>
      ) : null}
    </div>
  );
}

export function IndicatorView({
  indicator,
  catalog,
}: {
  indicator: Indicator;
  catalog: Indicator[];
}) {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("now");
  const [focusMark, setFocusMark] = useState<string>();
  const { statsFor, viewRole } = useProgress();
  const prep = statsFor(indicator, viewRole);

  const hits = useMemo(() => (q ? searchIndicators(catalog, q) : []), [q, catalog]);
  const hitIndex = hits.findIndex((h) => h.id === indicator.id);
  const prevHit = hitIndex > 0 ? hits[hitIndex - 1] : null;
  const nextHit = hitIndex >= 0 && hitIndex < hits.length - 1 ? hits[hitIndex + 1] : null;
  const thisHit = hitIndex >= 0 ? hits[hitIndex] : null;

  const prevId = indicator.id > 1 ? indicator.id - 1 : null;
  const nextId = indicator.id < 45 ? indicator.id + 1 : null;
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";

  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (!hash) return;
    const m = hash.match(/^crit-\d+-(.+)$/);
    if (m) setFocusMark(m[1]);
    const go = () => {
      const el = document.getElementById(hash);
      if (!el) return false;
      el.scrollIntoView({ block: "start" });
      el.classList.add("ring-2", "ring-teal-600");
      return true;
    };
    if (go()) return;
    const t = window.setTimeout(go, 250);
    return () => window.clearTimeout(t);
  }, [indicator.id]);

  return (
    <article className="space-y-4">
      <button type="button" className="min-h-11 rounded-xl border bg-white px-3 text-[16px]" onClick={() => window.history.back()}>
        뒤로
      </button>
      {q && thisHit ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm">
          <p>
            ‘{q}’ 검색 결과 <b>{hitIndex + 1}</b> / {hits.length} · 이 지표에서 {thisHit.matchCount}곳
          </p>
          <div className="flex gap-2">
            {prevHit ? (
              <Link className="rounded-full bg-white px-3 py-1" href={`/indicators/${prevHit.id}${qs}`}>
                이전 관련 지표
              </Link>
            ) : null}
            {nextHit ? (
              <Link className="rounded-full bg-(--teal) px-3 py-1 text-white" href={`/indicators/${nextHit.id}${qs}`}>
                다음 관련 지표
              </Link>
            ) : (
              <Link className="rounded-full bg-white px-3 py-1" href={`/search${qs}`}>
                목록으로
              </Link>
            )}
          </div>
        </div>
      ) : null}

      <header className="rounded-2xl border border-(--line) bg-(--card) p-5">
        <p className="text-xs text-stone-500">
          {indicator.area} · {indicator.sub}
        </p>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-2xl font-bold">
            지표 {indicator.id} · {indicator.name}
          </h2>
          <span className="text-2xl font-bold text-(--teal)">{indicator.score}점</span>
          {indicator.isNew ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">신설</span>
          ) : null}
          {prep.total > 0 ? (
            <ProgressCounts done={prep.done} left={prep.left} complete={prep.complete} />
          ) : null}
        </div>
      </header>

      <LinkedWorkflows indicatorId={indicator.id} names={new Map(catalog.map((c) => [c.id, c.name]))} />

      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 gap-1 rounded-full bg-stone-200/70 p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`min-h-11 min-w-0 flex-1 whitespace-nowrap rounded-full px-1.5 text-[13px] sm:flex-none sm:px-4 sm:text-sm ${tab === t.id ? "bg-(--teal) text-white" : "text-stone-600"}`}
            >
              <span className="sm:hidden">{t.short}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
        <OriginalFiles pages={indicator.fullSource?.filePages} compact />
      </div>

      {tab === "now" && indicator.fullSource ? (
        <IndicatorSourcePanel full={indicator.fullSource} indicator={indicator} focusMark={focusMark} />
      ) : null}

      <div className={tab === "both" ? "grid gap-4 lg:grid-cols-2" : undefined}>
        {tab === "now" && !indicator.fullSource && (
          <div className="space-y-3">
            <SidePanel year="2025년 이번 평가" side={indicator.curr} query={q} currIndicator={indicator} emphasizeMethods />
          </div>
        )}
        {tab === "prev" && <SidePanel year="2021년 이전 평가" side={indicator.prev} query={q} />}
        {tab === "both" && (
          <>
            <div className="rounded-2xl border border-stone-200 bg-stone-100/60 p-4">
              <SidePanel year="왼쪽 · 이전(2021)" side={indicator.prev} query={q} />
            </div>
            <div className="rounded-2xl border-2 border-amber-400 bg-(--card) p-4">
              <SidePanel
                year="오른쪽 · 이번(2025) · 달라진 점 강조"
                side={indicator.curr}
                query={q}
                prevForDiff={indicator.prev.text}
                showDiffLegend
                currIndicator={indicator}
                emphasizeMethods
              />
            </div>
          </>
        )}
      </div>

      <nav className="flex justify-between text-sm">
        {prevId ? (
          <Link href={`/indicators/${prevId}${qs}`} className="text-(--teal)">
            ← {prevId}번
          </Link>
        ) : (
          <span />
        )}
        <Link href="/indicators" className="text-stone-500">
          목록
        </Link>
        {nextId ? (
          <Link href={`/indicators/${nextId}${qs}`} className="text-(--teal)">
            {nextId}번 →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}

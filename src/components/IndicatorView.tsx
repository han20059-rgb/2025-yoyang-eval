"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ManualText, extractPurpose, splitScoring } from "@/components/Highlight";
import type { Indicator, Side } from "@/lib/types";
import { searchIndicators } from "@/lib/search";
import { indicatorMeta } from "@/data/indicatorMeta";

const tabs = [
  { id: "now", label: "이번 평가" },
  { id: "prev", label: "이전 평가" },
  { id: "both", label: "나란히" },
] as const;

function Section({
  kicker,
  title,
  children,
}: {
  kicker?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <header className="border-b border-stone-200 bg-stone-50 px-4 py-2">
        {kicker ? <p className="text-[11px] font-medium tracking-wide text-stone-500">{kicker}</p> : null}
        <h3 className="text-sm font-bold text-(--teal)">{title}</h3>
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
}: {
  year: string;
  side: Side;
  query?: string;
  prevForDiff?: string;
  showDiffLegend?: boolean;
}) {
  const { goal, purpose } = extractPurpose(side.intro);
  const scoring = splitScoring(side.criteria);

  return (
    <div className="min-w-0 space-y-3">
      <p className="text-xs font-semibold tracking-wide text-stone-500">{year}</p>
      {showDiffLegend ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          노란 배경·<b>달라짐</b> 표시는 이전 평가 본문에 없던 내용입니다.
        </p>
      ) : null}

      {(goal || purpose) && (
        <Section kicker="이 지표가 보려는 것" title="평가방향">
          {goal ? (
            <p className="mb-2 font-medium text-stone-900">
              <ManualText text={goal} query={query} prevForDiff={prevForDiff} />
            </p>
          ) : null}
          {purpose ? <ManualText text={purpose} query={query} prevForDiff={prevForDiff} /> : null}
        </Section>
      )}

      <Section kicker="무엇을 충족해야 하는가" title="평가기준">
        <ManualText text={scoring.body} query={query} prevForDiff={prevForDiff} />
      </Section>

      {scoring.scoring ? (
        <Section kicker="몇 점을 주는가" title="채점기준">
          <ManualText text={scoring.scoring} query={query} prevForDiff={prevForDiff} />
        </Section>
      ) : null}

      <Section kicker="언제부터 적용하는가" title="지표적용기간">
        <ManualText text={side.period || "본문에 별도 기간이 없으면 매뉴얼 일반사항(2022.1. ~ 2025년 평가일)을 따릅니다."} query={query} prevForDiff={prevForDiff} />
      </Section>

      <Section kicker="어떻게 확인하는가" title="확인방법">
        <ManualText text={side.method} query={query} prevForDiff={prevForDiff} />
      </Section>

      {side.law?.trim() ? (
        <Section kicker="법령·고시" title="관련근거">
          <ManualText text={side.law} query={query} prevForDiff={prevForDiff} />
        </Section>
      ) : null}
    </div>
  );
}

function RelatedBlock({
  ids,
  query,
  catalog,
}: {
  ids: { id: number; why: string }[];
  query: string;
  catalog: Indicator[];
}) {
  const router = useRouter();
  const [goId, setGoId] = useState("");
  const q = query ? `?q=${encodeURIComponent(query)}` : "";
  const named = ids
    .map((r) => {
      const ind = catalog.find((i) => i.id === r.id);
      return ind ? { ...r, name: ind.name } : null;
    })
    .filter((x): x is { id: number; why: string; name: string } => Boolean(x));

  if (named.length === 0) return null;

  return (
    <section className="rounded-2xl border border-(--line) bg-(--card) p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-stone-500">다른 평가지표와 연결</p>
          <h3 className="text-sm font-bold">같이 보면 좋은 지표 {named.length}개</h3>
        </div>
        {named.length > 1 ? (
          <div className="flex items-center gap-2 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-stone-500">한곳에서 이동</span>
              <select
                className="max-w-56 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm outline-none ring-(--teal) focus:ring-2"
                value={goId}
                onChange={(e) => setGoId(e.target.value)}
              >
                <option value="">지표 선택</option>
                {named.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id}번 {r.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!goId}
              onClick={() => router.push(`/indicators/${goId}${q}`)}
              className="rounded-full bg-(--teal) px-3 py-1.5 text-white disabled:opacity-40"
            >
              이동
            </button>
          </div>
        ) : null}
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {named.map((r) => (
          <li key={r.id}>
            <Link
              href={`/indicators/${r.id}${q}`}
              className="flex items-start justify-between gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2 hover:border-(--teal)"
            >
              <span>
                <span className="font-semibold text-(--teal)">
                  {r.id}번 {r.name}
                </span>
                <span className="mt-0.5 block text-xs text-stone-600">{r.why}</span>
              </span>
              <span className="shrink-0 text-xs text-stone-400">열기 →</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
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
  const meta = indicatorMeta[indicator.id];

  const hits = useMemo(() => (q ? searchIndicators(catalog, q) : []), [q, catalog]);
  const hitIndex = hits.findIndex((h) => h.id === indicator.id);
  const prevHit = hitIndex > 0 ? hits[hitIndex - 1] : null;
  const nextHit = hitIndex >= 0 && hitIndex < hits.length - 1 ? hits[hitIndex + 1] : null;
  const thisHit = hitIndex >= 0 ? hits[hitIndex] : null;

  const prevId = indicator.id > 1 ? indicator.id - 1 : null;
  const nextId = indicator.id < 45 ? indicator.id + 1 : null;
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";

  return (
    <article className="space-y-4">
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
          {indicator.pages[0] ? ` · 매뉴얼 ${indicator.pages[0]}쪽` : ""}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-(--teal) px-2.5 py-1 text-sm font-bold text-white">지표 {indicator.id}</span>
          <h2 className="text-2xl font-bold">{indicator.name}</h2>
          {indicator.isNew ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">신설</span>
          ) : null}
          <span className="rounded-full bg-(--teal-soft) px-2 py-0.5 text-xs text-(--teal)">{indicator.score}점</span>
        </div>
        {indicator.prevIndicators.length > 0 ? (
          <p className="mt-2 text-sm text-stone-600">
            이전 평가 대응: {indicator.prevIndicators.map((p) => `${p.id}번 ${p.name}(${p.score}점)`).join(", ")}
          </p>
        ) : (
          <p className="mt-2 text-sm text-amber-800">2021년에는 없던 지표입니다.</p>
        )}
      </header>

      {meta ? (
        <section className="rounded-2xl border border-teal-200 bg-(--teal-soft) p-4">
          <p className="text-[11px] font-medium tracking-wide text-(--teal)">가장 중요한 것</p>
          <h3 className="text-sm font-bold text-stone-900">핵심 요약</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-stone-800">
            {meta.keyPoints.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {meta ? <RelatedBlock ids={meta.related} query={q} catalog={catalog} /> : null}

      <div className="flex gap-1 rounded-full bg-stone-200/70 p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm ${tab === t.id ? "bg-(--teal) text-white" : "text-stone-600"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "now" && meta?.diffs.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-semibold text-amber-900">이전 평가와 달라진 점</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-amber-950">
            {meta.diffs.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === "both" && meta?.diffs.length ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="text-xs font-semibold text-amber-900">이번 평가(오른쪽)에서 달라진 점</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-amber-950">
            {meta.diffs.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={tab === "both" ? "grid gap-4 lg:grid-cols-2" : undefined}>
        {tab === "now" && <SidePanel year="2025년 이번 평가" side={indicator.curr} query={q} />}
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

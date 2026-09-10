"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Highlight } from "@/components/Highlight";
import { searchIndicators } from "@/lib/search";
import type { Indicator } from "@/lib/types";
import { indicatorMeta } from "@/data/indicatorMeta";

export function SearchResults({ indicators }: { indicators: Indicator[] }) {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const hits = useMemo(() => searchIndicators(indicators, q), [indicators, q]);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
  }, [q]);
  const current = hits[Math.min(index, Math.max(0, hits.length - 1))];
  const full = current ? indicators.find((i) => i.id === current.id) : null;

  if (!q.trim()) {
    return <p className="text-stone-600">검색어를 입력하세요. 예: 사회복지사</p>;
  }

  if (hits.length === 0) {
    return (
      <p className="text-stone-600">
        ‘{q}’에 해당하는 지표가 없습니다. 다른 단어로 다시 검색해 보세요.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-bold">‘{q}’ 검색 결과</h2>
        <p className="mt-1 text-sm text-stone-600">
          {hits.length}개 지표에서 발견되었습니다. 아래에서 하나씩 열고, 본문의 노란 표시를 확인하세요.
        </p>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {hits.map((h, i) => (
          <button
            key={h.id}
            type="button"
            onClick={() => setIndex(i)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
              i === index ? "bg-(--teal) text-white" : "bg-white border border-(--line)"
            }`}
          >
            {h.id}번 · {h.matchCount}곳
          </button>
        ))}
      </div>

      {current && full ? (
        <section className="rounded-2xl border border-(--line) bg-(--card) p-5">
          <p className="text-xs text-stone-500">
            {index + 1} / {hits.length} · {current.area} · {current.sub}
          </p>
          <h3 className="mt-1 text-xl font-bold">
            {current.id}. {current.name}{" "}
            <span className="text-base font-medium text-stone-500">{current.score}점</span>
          </h3>
          <p className="mt-3 text-sm leading-relaxed">{full.changeNote}</p>
          {indicatorMeta[current.id] ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-stone-800">
              {indicatorMeta[current.id].keyPoints.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}

          <ul className="mt-4 space-y-2">
            {current.snippets.map((s, i) => (
              <li key={i} className="rounded-lg bg-amber-50/80 px-3 py-2 text-sm">
                <span className="mr-2 text-xs font-medium text-amber-800">{s.label}</span>
                <Highlight text={s.text} query={q} />
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={`/indicators/${current.id}?q=${encodeURIComponent(q)}`}
              className="rounded-full bg-(--teal) px-4 py-2 text-sm text-white"
            >
              이 지표 전체 설명 보기
            </Link>
            <button
              type="button"
              disabled={index === 0}
              onClick={() => setIndex((v) => Math.max(0, v - 1))}
              className="rounded-full border border-(--line) px-4 py-2 text-sm disabled:opacity-40"
            >
              이전 지표
            </button>
            <button
              type="button"
              disabled={index >= hits.length - 1}
              onClick={() => setIndex((v) => Math.min(hits.length - 1, v + 1))}
              className="rounded-full border border-(--line) px-4 py-2 text-sm disabled:opacity-40"
            >
              다음 지표
            </button>
          </div>
        </section>
      ) : null}

      <ol className="space-y-2 text-sm">
        {hits.map((h, i) => (
          <li key={h.id}>
            <button type="button" className="text-left text-(--teal) hover:underline" onClick={() => setIndex(i)}>
              {h.id}번 {h.name}
            </button>
            <span className="text-stone-500"> · {h.matchCount}곳 · {h.area}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

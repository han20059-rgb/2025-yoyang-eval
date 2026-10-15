"use client";

import { EmphText } from "@/components/EmphText";
import { EvalBadges } from "@/components/EvalBadges";
import type { ChangeKind, MethodDef } from "@/lib/evalCriteria";
import type { PracticeBand, PracticeCard } from "@/lib/practiceGuide";
import type { ReactNode } from "react";

const BAND_CLASS: Record<PracticeBand["kind"], string> = {
  do: "band-do",
  when: "band-when",
  deny: "band-deny",
  detail: "band-detail",
};

export function ScoreConditions({
  rows,
}: {
  rows: { score: string; condition: string; groupMarks: string; joint: boolean; notes?: string[] }[];
}) {
  if (!rows.length) return null;
  return (
    <div className="mt-1.5 space-y-1.5 border-t border-stone-100 pt-1.5">
      {rows.map((r, i) => (
        <div key={`${r.score}-${r.condition}-${i}`} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
          <p className="shrink-0 text-[22px] font-bold leading-7 text-(--teal) sm:w-[4.5rem]">
            {r.score}
            <span className="ml-0.5 text-[14px] font-semibold">점</span>
          </p>
          <div className="min-w-0">
            {r.joint && r.groupMarks ? (
              <p className="text-[13px] font-semibold text-stone-500">공동 채점 {r.groupMarks}</p>
            ) : null}
            <p className="text-[16px] leading-7 text-stone-800">{r.condition || "채점기준 원문에서 조건을 확인한다."}</p>
            {r.notes?.length ? <p className="mt-0.5 text-[14px] leading-6 text-stone-600">{r.notes.join(" ")}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PracticeBands({ bands }: { bands: PracticeBand[] }) {
  return (
    <div className="mt-2 space-y-1.5">
      {bands.map((band) => (
        <div key={`${band.kind}-${band.title}`} className={`${BAND_CLASS[band.kind]} rounded-md px-2.5 py-1.5`}>
          <p className="text-[13px] font-bold tracking-wide text-stone-800">{band.title}</p>
          {band.groups.map((g, gi) => (
            <div key={g.heading || gi} className={g.heading ? "mt-2 border-t border-black/10 pt-2 first:mt-1 first:border-t-0 first:pt-0" : "mt-1"}>
              {g.heading ? <p className="text-[15px] font-bold leading-7 text-stone-900">{g.heading}</p> : null}
              <ul className="mt-0.5 space-y-1">
                {g.items.map((item) => (
                  <li key={item.text} className="text-[16px] leading-7 text-stone-900">
                    <EmphText text={item.text} phrases={item.emphasis} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function CriterionCard({
  mark,
  title,
  methods,
  changeKind,
  focused,
  scores,
  bands,
  details,
  children,
}: {
  mark: string;
  title: string;
  methods: MethodDef[];
  changeKind?: ChangeKind | null;
  focused?: boolean;
  scores: { score: string; condition: string; groupMarks: string; joint: boolean; notes?: string[] }[];
  bands?: PracticeBand[];
  details?: PracticeCard["details"];
  children?: ReactNode;
}) {
  return (
    <article className={`rounded-lg border border-stone-200 bg-white p-2.5 shadow-sm ${focused ? "ring-2 ring-teal-600" : ""}`}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-[13px] font-bold text-stone-500">기준 {mark}</p>
        <h3 className="min-w-0 text-[18px] font-bold leading-7 text-stone-950">{title}</h3>
        <EvalBadges changeKind={changeKind} methods={methods} />
      </div>
      <ScoreConditions rows={scores} />
      {bands?.length ? <PracticeBands bands={bands} /> : null}
      {children}
      {details?.length ? (
        <details className="band-detail mt-2 rounded-md px-2.5 py-1.5">
          <summary className="min-h-11 cursor-pointer text-[16px] font-semibold leading-7">자세한 조건·원문·예시</summary>
          <div className="mt-2 space-y-3">
            {details.map((d) => (
              <div key={d.title} className="border-t border-stone-300/60 pt-2">
                <p className="text-[15px] font-semibold">{d.title}</p>
                <p className="mt-1 whitespace-pre-wrap text-[16px] leading-7">{d.text}</p>
                {d.filePage ? <p className="text-[13px] text-stone-500">원본 {d.filePage}쪽</p> : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </article>
  );
}

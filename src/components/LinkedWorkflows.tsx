"use client";

import Link from "next/link";
import { useWorkflows } from "@/components/WorkflowProvider";
import type { Workflow } from "@/lib/workflows/types";

function Kind({ kind }: { kind: Workflow["kind"] }) {
  return <span className="text-xs text-stone-500">{kind === "original" ? "원문 직접 연결" : "실무상 연결 제안"}</span>;
}

export function WorkflowCard({ item, names }: { item: Workflow; names: Map<number, string> }) {
  return (
    <article className="rounded-2xl border border-(--line) bg-(--card) p-4">
      <h3 className="text-[17px] font-semibold leading-7">{item.name}</h3>
      <p className="mt-1 text-[15px] leading-7 text-stone-700">{item.shortFlow}</p>
      <p className="mt-1 text-[14px] leading-6">
        {item.indicatorIds.map((id) => (
          <Link key={id} className="mr-2 inline-flex min-h-11 items-center text-(--teal) underline" href={`/indicators/${id}`}>
            {id}. {names.get(id) || ""}
          </Link>
        ))}
      </p>
      {item.mustCheck.length ? (
        <ul className="mt-2 list-disc pl-5 text-[15px] leading-7">
          {item.mustCheck.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      ) : null}
      {item.recheck ? <p className="mt-2 text-sm text-amber-800">재확인 필요 · {item.recheckNote} · 준비 체크는 바꾸지 않습니다.</p> : null}
      <p className="mt-2">
        <Kind kind={item.kind} />
      </p>
      <details className="mt-2">
        <summary className="min-h-11 cursor-pointer text-[16px]">준비 순서와 지표별 조건 보기</summary>
        <ol className="mt-2 space-y-2">
          {item.steps.map((s) => (
            <li key={s.id} className="rounded-xl border border-stone-200 p-3">
              <p className="font-semibold">
                {s.order}. {s.title}
              </p>
              <p className="text-[15px] leading-7">{s.work}</p>
              {s.evidence ? <p className="text-sm text-stone-500">증빙: {s.evidence}</p> : null}
            </li>
          ))}
        </ol>
        <ul className="mt-3 space-y-2">
          {item.conditions.map((c) => (
            <li key={`${c.indicatorId}-${c.marks.join("")}`} className="rounded-xl bg-stone-50 p-3 text-[15px] leading-7">
              <Link className="text-(--teal) underline" href={`/indicators/${c.indicatorId}${c.marks[0] ? `#crit-${c.indicatorId}-${c.marks[0]}` : ""}`}>
                지표 {c.indicatorId} {c.marks.join(" ")}
              </Link>
              <p>대상 {c.audience || "원문 확인"} · 주기 {c.period || "원문 확인"}</p>
              {c.deadline ? <p>기한 {c.deadline}</p> : null}
              {c.confirmMethod ? <p>확인 {c.confirmMethod}</p> : null}
            </li>
          ))}
        </ul>
        {item.duplicateLimits.length ? (
          <div className="mt-2 rounded-xl bg-amber-50 p-3 text-[15px] leading-7">
            {item.duplicateLimits.map((d) => (
              <p key={d}>{d}</p>
            ))}
          </div>
        ) : null}
        <div className="mt-2 space-y-1 text-[14px] leading-6 text-stone-600">
          {item.sources.map((s, i) => (
            <p key={i}>
              근거 지표 {s.indicatorId}
              {s.mark || ""} · {s.filePage ? `파일 ${s.filePage}쪽` : "쪽수 확인 필요"}
              {s.visualCheck ? " · 원문 육안 확인 필요" : ""}
              {s.quote ? ` · “${s.quote}”` : " · 인용 없음"}
            </p>
          ))}
        </div>
        {!item.sources.some((s) => s.quote) ? <p className="mt-2 text-sm text-amber-800">근거 인용이 없어 확정된 원문 연결처럼 보지 마세요.</p> : null}
      </details>
    </article>
  );
}

export function LinkedWorkflows({ indicatorId, names }: { indicatorId: number; names: Map<number, string> }) {
  const { published } = useWorkflows();
  const items = published.filter((w) => w.indicatorIds.includes(indicatorId));
  if (!items.length) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-[16px] font-bold">함께 준비할 업무</h3>
      {items.map((item) => (
        <WorkflowCard key={item.id} item={item} names={names} />
      ))}
    </section>
  );
}

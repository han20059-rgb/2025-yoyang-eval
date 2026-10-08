"use client";

import { LawAccordion, OriginalProse, ZoomBox } from "@/components/OriginalProse";
import type { RoleId } from "@/data/duties";
import type { IndicatorFullSource } from "@/lib/types";

function Block({
  title,
  text,
  note,
  myRole,
  mineOnly,
}: {
  title: string;
  text: string;
  note?: string;
  myRole?: RoleId | null;
  mineOnly?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <header className="border-b border-stone-200 bg-stone-50 px-4 py-3">
        <h3 className="text-[16px] font-bold text-(--teal)">{title}</h3>
        {note ? <p className="mt-1 text-[13px] text-stone-500">{note}</p> : null}
      </header>
      <div className="px-4 py-3">
        <OriginalProse text={text} myRole={myRole} mineOnly={mineOnly} />
      </div>
    </section>
  );
}

export function IndicatorSourcePanel({
  full,
  mineOnly = false,
  myRole = null,
}: {
  full: IndicatorFullSource;
  mineOnly?: boolean;
  myRole?: RoleId | null;
}) {
  const fileNote = `파일 순서 ${full.filePages.join(", ") || "미확인"}쪽 · 인쇄 ${full.printedPages.join(", ") || "미확인"}쪽`;
  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-teal-50 px-3 py-2 text-[13px] leading-6 text-teal-900">
        로컬 원문 미리보기입니다. 운영 확정본이 아닙니다. {fileNote}
        {full.imagePages.length ? ` · 이미지 쪽 ${full.imagePages.join(", ")}` : ""}
      </p>
      <Block title="평가방향" text={full.sections.direction.text} myRole={myRole} mineOnly={mineOnly} />
      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h3 className="text-[16px] font-bold text-(--teal)">평가기준 · 확인방법</h3>
        <p className="mt-1 text-[13px] text-stone-500">기준마다 본문과 확인방법을 나눴습니다. 핵심 요약이 아닙니다.</p>
        <div className="mt-3 space-y-3">
          {full.criteriaItems.length ? (
            full.criteriaItems.map((it) => (
              <article key={it.mark} className="rounded-xl border border-stone-200 p-3">
                <p className="text-[16px] font-semibold">{it.mark}</p>
                {mineOnly && !myRole ? <p className="text-sm text-amber-800">내 평가 직종이 연결되지 않아 담당만 보기를 확정하지 않습니다.</p> : null}
                <OriginalProse text={it.text} myRole={myRole} mineOnly={mineOnly} />
                {it.period ? (
                  <p className="mt-2 text-[14px] text-stone-600">
                    이 기준 적용기간: {it.period}
                  </p>
                ) : null}
                <div className="mt-2 rounded-lg bg-stone-50 p-2">
                  <p className="text-[13px] font-semibold text-stone-500">확인방법</p>
                  <OriginalProse text={it.confirm} empty="이 기준의 확인방법을 따로 가르지 못했습니다. 아래 전체 확인방법을 보세요." myRole={myRole} mineOnly={mineOnly} />
                </div>
              </article>
            ))
          ) : (
            <OriginalProse text={full.sections.criteria.text} myRole={myRole} mineOnly={mineOnly} />
          )}
        </div>
      </section>
      <Block title="평가방법" text={full.sections.methodNote.text} myRole={myRole} mineOnly={mineOnly} />
      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h3 className="text-[16px] font-bold text-(--teal)">채점기준</h3>
        <div className="mt-2 overflow-x-auto">
          <OriginalProse text={full.sections.scoring.text} myRole={myRole} mineOnly={mineOnly} />
        </div>
        <div className="mt-2">
          <ZoomBox title="채점기준 확대">
            <OriginalProse text={full.sections.scoring.text} myRole={myRole} mineOnly={mineOnly} />
          </ZoomBox>
        </div>
      </section>
      <Block title="기본 적용기간" text={full.sections.periodDefault.text} note="평가 주기 메모와는 별도입니다." myRole={myRole} mineOnly={mineOnly} />
      <Block title="기준별 적용기간" text={full.sections.periodByCriterion.text} myRole={myRole} mineOnly={mineOnly} />
      <Block title="확인방법 전체" text={full.sections.confirm.text} myRole={myRole} mineOnly={mineOnly} />
      <Block title="예시" text={full.sections.examples.text} myRole={myRole} mineOnly={mineOnly} />
      <Block title="주의사항" text={full.sections.cautions.text} myRole={myRole} mineOnly={mineOnly} />
      <Block title="예외조건" text={full.sections.exceptions.text} myRole={myRole} mineOnly={mineOnly} />
      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h3 className="mb-2 text-[16px] font-bold text-(--teal)">관련근거</h3>
        <LawAccordion blocks={full.lawBlocks} />
      </section>
      {full.imagePages.length ? (
        <ZoomBox title="표·이미지 원본">
          <p className="mb-2 text-[15px] leading-7">
            파일 순서 {full.imagePages.join(", ")}쪽. OCR이 비어도 이미지를 보여 줍니다. 인쇄 쪽과 파일 순서는 다를 수 있습니다.
          </p>
          <div className="space-y-3">
            {full.imagePages.map((p) => {
              const ocr = full.imageOcr?.find((o) => o.page === p);
              return (
                <figure key={p} className="space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/preview/page-image?page=${p}`}
                    alt={`파일 순서 ${p}쪽 원본 이미지`}
                    className="h-auto w-full rounded-lg border border-stone-200"
                  />
                  {ocr ? (
                    <figcaption className="rounded-lg bg-amber-50 px-3 py-2 text-[15px] leading-7 text-amber-950">
                      {ocr.ok ? `OCR: ${ocr.text}` : `확인 필요 · ${ocr.error || "OCR 실패"} · 위 원본 이미지를 보세요.`}
                    </figcaption>
                  ) : (
                    <figcaption className="text-[14px] text-stone-500">이 쪽은 원본 이미지로 확인하세요.</figcaption>
                  )}
                </figure>
              );
            })}
          </div>
          <OriginalProse text={full.sections.tablesImages.text} />
        </ZoomBox>
      ) : null}
      {full.needsReview ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-[15px] leading-7 text-amber-900">{full.reviewReasons.join(" / ")}</p>
      ) : null}
      <details className="rounded-2xl border border-stone-200 bg-white p-3">
        <summary className="min-h-11 cursor-pointer text-[16px] font-semibold">이 지표 원문 전체 펼치기</summary>
        <OriginalProse text={full.raw} myRole={myRole} mineOnly={false} />
      </details>
    </div>
  );
}

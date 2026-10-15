"use client";

import { type ReactNode } from "react";
import { CriterionWork } from "@/components/CriterionWork";
import { useStaffDirectory } from "@/components/useStaffDirectory";
import { ScoringCriteria } from "@/components/ScoringCriteria";
import { LawAccordion, OriginalProse, ZoomBox } from "@/components/OriginalProse";
import { useEvalSession } from "@/components/EvalSession";
import { MethodHeading } from "@/components/MethodText";
import { criterionFromSource, uniqueMethods } from "@/lib/evalCriteria";
import type { RoleId } from "@/data/duties";
import type { Indicator } from "@/lib/types";
import type { IndicatorFullSource } from "@/lib/types";

function Block({
  title,
  text,
  note,
  aside,
  myRole,
  mineOnly,
}: {
  title: string;
  text: string;
  note?: string;
  aside?: ReactNode;
  myRole?: RoleId | null;
  mineOnly?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <header className="border-b border-stone-200 bg-stone-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[16px] font-bold text-(--teal)">{title}</h3>
          {aside}
        </div>
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
  indicator,
  myRole = null,
  focusMark,
}: {
  full: IndicatorFullSource;
  indicator?: Indicator;
  mineOnly?: boolean;
  myRole?: RoleId | null;
  focusMark?: string;
}) {
  const { mode, identity } = useEvalSession();
  const staffDirState = useStaffDirectory(Boolean(identity?.isAdmin) && mode !== "demo");
  const staffDir =
    mode === "demo"
      ? [
          { leaveRecordId: 101, name: "김간호", jobType: "간호사" },
          { leaveRecordId: 102, name: "이사회", jobType: "사회복지사" },
          { leaveRecordId: 103, name: "박요양", jobType: "요양보호사" },
        ]
      : staffDirState.items;
  const criteria = (full.criteriaItems || []).map((it) => criterionFromSource(it));
  const methodNote =
    full.commonMethodNote ||
    (full.criteriaItems || [])
      .map((raw, i) => {
        const it = criteria[i];
        if (raw.methodScope === "indicator-common") return "";
        return it.methods.length ? `${it.mark} ${it.methods.map((m) => m.label).join(", ")}` : "";
      })
      .filter(Boolean)
      .join("\n");
  const directionMethods = uniqueMethods(criteria.flatMap((it) => it.methods));
  return (
    <div id="source" className="space-y-3 scroll-mt-4">
      <Block
        title="평가방향"
        aside={<MethodHeading methods={directionMethods} />}
        text={full.sections.direction.text}
        myRole={myRole}
        mineOnly={false}
      />
      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h3 className="text-[16px] font-bold text-(--teal)">평가기준</h3>
        <p className="mt-1 text-[13px] text-stone-500">책자 원문입니다. 확인방식은 원문에 적힌 것만 옆에 둡니다.</p>
        <div className="mt-3 space-y-3">
          {full.criteriaItems.length ? (
            full.criteriaItems.map((raw, i) => {
              const it = criteria[i];
              return (
              <article
                key={it.mark}
                id={indicator ? `crit-${indicator.id}-${it.mark}` : undefined}
                className={`scroll-mt-4 rounded-xl border p-3 ${focusMark === it.mark ? "ring-2 ring-teal-600" : "border-stone-200"}`}
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="text-[16px] font-semibold">{it.mark}</p>
                  <MethodHeading methods={it.methods} isNew={it.isNew} isChanged={it.isChanged} />
                </div>
                {it.text ? <OriginalProse text={it.text} myRole={myRole} mineOnly={false} /> : null}
                {raw.period ? (
                  <p className="mt-2 text-[14px] text-stone-600">
                    이 기준 적용기간: {raw.period}
                  </p>
                ) : null}
                {raw.confirm.trim() ? (
                <div className="mt-2 rounded-lg bg-stone-50 p-2">
                  <p className="text-[13px] font-semibold text-stone-500">확인방법</p>
                  <OriginalProse text={raw.confirm} myRole={myRole} mineOnly={false} />
                </div>
                ) : null}
                {indicator ? (
                  <CriterionWork
                    indicator={indicator}
                    mark={it.mark}
                    originalText={raw.text}
                    staffDir={staffDir}
                    staffDirError={mode === "demo" ? "" : staffDirState.error}
                    staffDirLoading={mode === "demo" ? false : staffDirState.loading}
                    onRetryStaffDir={mode === "demo" ? undefined : staffDirState.reload}
                  />
                ) : null}
              </article>
            );
            })
          ) : (
            <OriginalProse text={full.sections.criteria.text} myRole={myRole} mineOnly={false} />
          )}
        </div>
      </section>
      {methodNote && methodNote !== full.commonMethodNote ? <Block title="평가방법" text={methodNote} myRole={myRole} mineOnly={false} /> : null}
      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h3 className="text-[16px] font-bold text-(--teal)">채점기준</h3>
        <div className="mt-3">
          <ScoringCriteria text={full.sections.scoring.text} />
        </div>
      </section>
      {full.sections.periodDefault.text ? <Block title="기본 적용기간" text={full.sections.periodDefault.text} note="평가 주기 메모와는 별도입니다." myRole={myRole} mineOnly={false} /> : null}
      {full.sections.periodByCriterion.text ? <Block title="기준별 적용기간" text={full.sections.periodByCriterion.text} myRole={myRole} mineOnly={false} /> : null}
      {full.sections.confirm.text ? <Block title="확인방법 전체" text={full.sections.confirm.text} myRole={myRole} mineOnly={false} /> : null}
      {full.sections.examples.text ? <Block title="예시" text={full.sections.examples.text} myRole={myRole} mineOnly={false} /> : null}
      {full.sections.cautions.text ? <Block title="주의사항" text={full.sections.cautions.text} myRole={myRole} mineOnly={false} /> : null}
      {full.sections.exceptions.text ? <Block title="예외조건" text={full.sections.exceptions.text} myRole={myRole} mineOnly={false} /> : null}
      {full.lawBlocks.length ? (
      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h3 className="mb-2 text-[16px] font-bold text-(--teal)">관련근거</h3>
        <LawAccordion blocks={full.lawBlocks} />
      </section>
      ) : null}
      {full.imagePages.length ? (
        <ZoomBox title="표·이미지 원본">
          <p className="mb-2 text-[15px] leading-7">OCR이 비어도 원본 이미지를 보여 줍니다.</p>
          <div className="space-y-3">
            {full.imagePages.map((p) => {
              const ocr = full.imageOcr?.find((o) => o.page === p);
              return (
                <figure key={p} className="space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/preview/page-image?page=${p}`}
                    alt={`원본 이미지 ${p}쪽`}
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
        </ZoomBox>
      ) : null}
    </div>
  );
}

"use client";

import { CriterionCard } from "@/components/CriterionCard";
import { CriterionWork } from "@/components/CriterionWork";
import { OriginalFiles } from "@/components/OriginalFiles";
import { ScoringCriteria } from "@/components/ScoringCriteria";
import { LawAccordion, OriginalProse } from "@/components/OriginalProse";
import { useEvalSession } from "@/components/EvalSession";
import { useStaffDirectory } from "@/components/useStaffDirectory";
import { changeKindForCriterion, criterionFromSource, criteriaFromIndicator } from "@/lib/evalCriteria";
import { originalRangeHref, pdfRangeFor } from "@/lib/indicatorPdfRange";
import { originalPracticeCard } from "@/lib/originalCards";
import { scoresForMark } from "@/lib/parseScoring";
import { practiceGuideFor } from "@/lib/practiceGuide";
import type { Indicator } from "@/lib/types";

export function IndicatorWorkerView({
  indicator,
  catalog,
  focusMark,
  showPdfButton = true,
}: {
  indicator: Indicator;
  catalog: Indicator[];
  focusMark?: string;
  showPdfButton?: boolean;
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
  const full = indicator.fullSource;
  const guide = practiceGuideFor(indicator.id);
  const range = pdfRangeFor(indicator, catalog);
  const href = originalRangeHref(indicator, catalog);
  const scoring = full?.sections.scoring.text || "";
  const criteria = criteriaFromIndicator(indicator);

  function work(mark: string, originalText: string) {
    return (
      <CriterionWork
        indicator={indicator}
        mark={mark}
        originalText={originalText}
        staffDir={staffDir}
        staffDirError={mode === "demo" ? "" : staffDirState.error}
        staffDirLoading={mode === "demo" ? false : staffDirState.loading}
        onRetryStaffDir={mode === "demo" ? undefined : staffDirState.reload}
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-2">
        <p className="text-[14px] leading-6 text-stone-600">
          원본 {range.from}–{range.to}쪽
          {range.sharedWithNext ? ` · ${range.sharedWithNext.page}쪽에 지표 ${range.sharedWithNext.nextId} 시작(숨기지 않음)` : ""}
          {range.endBoundary ? ` · ${range.endBoundary.nextStarts}` : ""}
        </p>
        {showPdfButton ? <OriginalFiles indicatorId={indicator.id} from={range.from} to={range.to} href={href} compact /> : null}
      </div>

      {guide ? (
        <section className="space-y-2">
          <div className="border-b border-amber-200 pb-2">
            <p className="text-[13px] font-semibold text-amber-900">실무 안내 · 검토 중 · 공식 원문 아님</p>
            <p className="mt-1 text-[15px] leading-7 text-stone-700">{guide.linkReason}</p>
            <p className="mt-1 text-[13px] text-stone-500">
              근거 {guide.source.pdfFile} · {guide.source.pageStart}–{guide.source.pageEnd}쪽 · 승인 전
              {guide.aiGenerated ? " · AI 생성" : ""}
            </p>
          </div>
          {guide.cards.map((card) => {
            const it = criteria.find((c) => c.mark === card.mark);
            return (
              <div key={card.mark} id={`crit-${indicator.id}-${card.mark}`} className="scroll-mt-4">
                <CriterionCard
                  mark={card.mark}
                  title={card.title}
                  methods={it?.methods || []}
                  changeKind={it ? changeKindForCriterion(it) : null}
                  focused={focusMark === card.mark}
                  scores={scoresForMark(scoring, card.mark)}
                  bands={card.bands}
                  details={card.details}
                >
                  {it ? work(card.mark, it.text) : null}
                </CriterionCard>
              </div>
            );
          })}
        </section>
      ) : (
        <ol className="space-y-2">
          {(full?.criteriaItems || []).map((raw) => {
            const it = criterionFromSource(raw);
            const card = originalPracticeCard(indicator, raw);
            return (
              <li key={it.mark} id={`crit-${indicator.id}-${it.mark}`} className="scroll-mt-4">
                <CriterionCard
                  mark={it.mark}
                  title={card.title}
                  methods={it.methods}
                  changeKind={changeKindForCriterion(it)}
                  focused={focusMark === it.mark}
                  scores={scoresForMark(scoring, it.mark)}
                  bands={card.bands}
                  details={card.details}
                >
                  {work(it.mark, raw.text)}
                </CriterionCard>
              </li>
            );
          })}
        </ol>
      )}

      <details className="border-t border-stone-200 pt-2">
        <summary className="min-h-11 cursor-pointer text-[16px] font-semibold leading-7">자세한 조건·근거 보기</summary>
        <div className="mt-3 space-y-4">
          {full?.sections.scoring.text ? (
            <div>
              <p className="mb-2 text-[15px] font-semibold">채점기준</p>
              <ScoringCriteria text={full.sections.scoring.text} />
            </div>
          ) : null}
          {full?.sections.periodDefault.text ? (
            <div>
              <p className="text-[15px] font-semibold">적용기간</p>
              <OriginalProse text={full.sections.periodDefault.text} />
            </div>
          ) : null}
          {full?.sections.exceptions.text ? (
            <div>
              <p className="text-[15px] font-semibold">예외</p>
              <OriginalProse text={full.sections.exceptions.text} />
            </div>
          ) : null}
          {full?.sections.confirm.text ? (
            <div>
              <p className="text-[15px] font-semibold">확인방법 원문</p>
              <OriginalProse text={full.sections.confirm.text} />
            </div>
          ) : null}
          {full?.lawBlocks.length ? (
            <div>
              <p className="mb-1 text-[15px] font-semibold">관련근거</p>
              <LawAccordion blocks={full.lawBlocks} />
            </div>
          ) : null}
          <p className="text-[14px] leading-6 text-stone-600">그림·표·빈 페이지를 포함한 원문 전체는 원본 전체 보기에서 확인합니다. 준비 완료는 평가점수 충족이 아닙니다.</p>
        </div>
      </details>
    </div>
  );
}

"use client";

export function OriginalFiles({
  pages,
  compact = false,
  from,
  to,
  indicatorId,
  href,
}: {
  pages?: number[];
  compact?: boolean;
  from?: number;
  to?: number;
  indicatorId?: number;
  href?: string;
}) {
  const start = from || pages?.find((n) => Number.isFinite(n) && n > 0);
  const end = to || start;
  const q = new URLSearchParams();
  if (indicatorId) q.set("indicator", String(indicatorId));
  if (start) q.set("from", String(start));
  if (end) q.set("to", String(end));
  if (start && !from && !to) q.set("page", String(start));
  const link = href || `/preview/original-pdf${q.toString() ? `?${q.toString()}` : ""}`;
  const range = start && end && start !== end ? `${start}–${end}쪽` : start ? `${start}쪽` : "";
  return (
    <a
      className={
        compact
          ? "inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border bg-white px-2.5 text-[13px] font-medium text-stone-800 sm:px-3 sm:text-sm"
          : "inline-flex min-h-11 items-center justify-center rounded-xl border bg-white px-3"
      }
      href={link}
      target="_blank"
      rel="noreferrer"
    >
      {compact ? (
        <>
          <span className="sm:hidden">{range ? `원본 ${range}` : "원본 전체"}</span>
          <span className="hidden sm:inline">{range ? `원본 전체 보기 · ${range}` : "원본 전체 보기"}</span>
        </>
      ) : (
        range ? `원본 전체 보기 · ${range}` : "원본 전체 보기"
      )}
    </a>
  );
}

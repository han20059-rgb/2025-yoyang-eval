"use client";

export function OriginalFiles({ pages, compact = false }: { pages?: number[]; compact?: boolean }) {
  const page = pages?.find((n) => Number.isFinite(n) && n > 0);
  const query = page ? `?page=${page}` : "";
  return (
    <a
      className={
        compact
          ? "inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border bg-white px-2.5 text-[13px] font-medium text-stone-800 sm:px-3 sm:text-sm"
          : "inline-flex min-h-11 items-center justify-center rounded-xl border bg-white px-3"
      }
      href={`/preview/original-pdf${query}`}
      target="_blank"
      rel="noreferrer"
    >
      {compact ? (
        <>
          <span className="sm:hidden">{page ? `PDF · ${page}쪽 ↗` : "PDF ↗"}</span>
          <span className="hidden sm:inline">{page ? `원본 PDF · ${page}쪽 ↗` : "원본 PDF ↗"}</span>
        </>
      ) : (
        "원본 PDF 열기"
      )}
    </a>
  );
}

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { compareExtracts } from "@/lib/extract/compare";
import { extractManualFile } from "@/lib/extract";
import { getEdition, readStoredFile, saveExtracts } from "@/lib/manualStore";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  const { id } = await ctx.params;
  const edition = await getEdition(id);
  if (!edition) return NextResponse.json({ error: "없습니다." }, { status: 404 });
  if (!edition.files.pdf && !edition.files.hwp) {
    return NextResponse.json({ error: "등록된 파일이 없습니다." }, { status: 400 });
  }

  const extracts: { pdf?: Awaited<ReturnType<typeof extractManualFile>>; hwp?: Awaited<ReturnType<typeof extractManualFile>> } = {};
  if (edition.files.pdf) {
    const buf = await readStoredFile(edition.files.pdf.stored);
    extracts.pdf = await extractManualFile(buf, edition.files.pdf.name);
  }
  if (edition.files.hwp) {
    const buf = await readStoredFile(edition.files.hwp.stored);
    extracts.hwp = await extractManualFile(buf, edition.files.hwp.name);
  }

  const compare = compareExtracts(extracts.pdf || null, extracts.hwp || null);
  if (extracts.pdf) extracts.pdf.comparedWithOtherFormat = compare.compared;
  if (extracts.hwp) extracts.hwp.comparedWithOtherFormat = compare.compared;
  const saved = await saveExtracts(id, extracts, compare);
  return NextResponse.json({
    edition: {
      ...saved,
      extracts: {
        pdf: extracts.pdf && slim(extracts.pdf),
        hwp: extracts.hwp && slim(extracts.hwp),
      },
    },
    compare,
  });
}

function slim(ex: NonNullable<Awaited<ReturnType<typeof extractManualFile>>>) {
  return {
    format: ex.format,
    fileName: ex.fileName,
    status: ex.status,
    error: ex.error,
    warnings: ex.warnings,
    pageCount: ex.pageCount,
    classified: ex.classified,
    classifiedIsInterpretation: true,
    comparedWithOtherFormat: ex.comparedWithOtherFormat,
    needsReviewPages: ex.pages.filter((p) => p.needsReview).map((p) => ({
      page: p.page,
      printedPage: p.printedPage,
      charCount: p.charCount,
      imageCount: p.imageCount,
      ocrUsed: p.ocrUsed,
      reviewReasons: p.reviewReasons,
    })),
    pagesPreview: ex.pages.map((p) => ({
      page: p.page,
      printedPage: p.printedPage,
      charCount: p.charCount,
      imageCount: p.imageCount,
      ocrUsed: p.ocrUsed,
      needsReview: p.needsReview,
      reviewReasons: p.reviewReasons,
      textStart: p.text.slice(0, 400),
    })),
  };
}

import { mkdir, readFile, writeFile } from "fs/promises";
import { extractManualFile } from "../src/lib/extract/index.ts";
import { compareExtracts } from "../src/lib/extract/compare.ts";

async function main() {
  const pdfPath = process.argv[2];
  const hwpPath = process.argv[3];
  if (!pdfPath) {
    console.error("usage: npx tsx scripts/run-extract.ts <pdf> [hwp|hwpx]");
    process.exit(1);
  }

  const outDir = "data/manual-store/test-runs";
  await mkdir(outDir, { recursive: true });

  const pdfBuf = await readFile(pdfPath);
  console.log("PDF start", pdfPath, pdfBuf.length);
  const pdf = await extractManualFile(pdfBuf, pdfPath.split(/[/\\]/).pop() || "manual.pdf");
  const pdfSummary = {
    status: pdf.status,
    error: pdf.error,
    pageCount: pdf.pageCount,
    warnings: pdf.warnings,
    page58: pdf.pages.find((p) => p.page === 58 || p.printedPage === 58),
    page59: pdf.pages.find((p) => p.page === 59 || p.printedPage === 59),
    page82: pdf.pages.find((p) => p.page === 82),
    page83: pdf.pages.find((p) => p.page === 83),
    needsReview: pdf.pages.filter((p) => p.needsReview).map((p) => ({
      page: p.page,
      printedPage: p.printedPage,
      charCount: p.charCount,
      imageCount: p.imageCount,
      ocrUsed: p.ocrUsed,
      reviewReasons: p.reviewReasons,
    })),
  };
  await writeFile(`${outDir}/pdf-extract.json`, JSON.stringify({ summary: pdfSummary, extract: pdf }, null, 2), "utf8");
  console.log("PDF", JSON.stringify(pdfSummary, null, 2));

  if (hwpPath) {
    const hwpBuf = await readFile(hwpPath);
    console.log("HWP start", hwpPath, hwpBuf.length);
    const hwp = await extractManualFile(hwpBuf, hwpPath.split(/[/\\]/).pop() || "manual.hwp");
    const hwpSummary = {
      status: hwp.status,
      error: hwp.error,
      pageCount: hwp.pageCount,
      warnings: hwp.warnings,
      charCount: hwp.pages.reduce((n, p) => n + p.charCount, 0),
      textStart: hwp.pages[0]?.text.slice(0, 400) || "",
    };
    await writeFile(`${outDir}/hwp-extract.json`, JSON.stringify({ summary: hwpSummary, extract: hwp }, null, 2), "utf8");
    const cmp = compareExtracts(pdf, hwp);
    await writeFile(`${outDir}/compare.json`, JSON.stringify(cmp, null, 2), "utf8");
    console.log("HWP", JSON.stringify(hwpSummary, null, 2));
    console.log("COMPARE", JSON.stringify({ compared: cmp.compared, note: cmp.note, diffs: cmp.diffs.length }, null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

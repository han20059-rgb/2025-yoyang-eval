import { createHash } from "crypto";
import { copyFile, mkdir, readFile, stat, writeFile } from "fs/promises";
import { basename } from "path";
import { compareExtracts } from "../src/lib/extract/compare.ts";
import { extractManualFile } from "../src/lib/extract/index.ts";
import { auditAgainstBundle, parseIndicatorsFromPages } from "../src/lib/extract/parseIndicators.ts";

const SRC_PDF = "E:\\이전내용\\이전\\2025 평가매뉴얼.pdf";
const SRC_HWP = "E:\\이전내용\\이전\\2025 평가매뉴얼.hwp";
const WORKSPACE_PDF = "C:\\cu\\pg\\manual.pdf";
const OFF_DIR = "data/manual-store/official";
const OUT = "data/manual-store/test-runs";

function sha(buf: Buffer) {
  return createHash("sha256").update(buf).digest("hex");
}

async function main() {
  await mkdir(OFF_DIR, { recursive: true });
  await mkdir(OUT, { recursive: true });
  await copyFile(SRC_PDF, `${OFF_DIR}/2025-eval-manual.pdf`);
  await copyFile(SRC_HWP, `${OFF_DIR}/2025-eval-manual.hwp`);

  const pdfBuf = await readFile(`${OFF_DIR}/2025-eval-manual.pdf`);
  const hwpBuf = await readFile(`${OFF_DIR}/2025-eval-manual.hwp`);
  let workspace: { bytes: number; sha: string } | null = null;
  try {
    const w = await readFile(WORKSPACE_PDF);
    workspace = { bytes: w.length, sha: sha(w) };
  } catch {
    workspace = null;
  }

  const identity = {
    attachedPdf: { name: basename(SRC_PDF), bytes: pdfBuf.length, sha256: sha(pdfBuf), header: pdfBuf.subarray(0, 8).toString("latin1") },
    attachedHwp: { name: basename(SRC_HWP), bytes: hwpBuf.length, sha256: sha(hwpBuf), header: hwpBuf.subarray(0, 8).toString("latin1") },
    workspacePdf: workspace,
    samePdfAsWorkspace: workspace ? workspace.sha === sha(pdfBuf) : false,
    pdfEqualsHwpBytes: false,
    note: "파일명·평가연도가 같아도 배포본을 같게 보지 않습니다.",
  };
  await writeFile(`${OUT}/edition-identity.json`, JSON.stringify(identity, null, 2), "utf8");
  console.log("identity", JSON.stringify({ ...identity, attachedPdf: { ...identity.attachedPdf, sha256: identity.attachedPdf.sha256.slice(0, 12) }, attachedHwp: { ...identity.attachedHwp, sha256: identity.attachedHwp.sha256.slice(0, 12) } }));

  console.log("PDF extract start");
  const pdf = await extractManualFile(pdfBuf, "2025-eval-manual.pdf");
  await writeFile(`${OUT}/official-pdf-extract.json`, JSON.stringify({
    status: pdf.status,
    error: pdf.error,
    pageCount: pdf.pageCount,
    warnings: pdf.warnings,
    imageOrOcr: pdf.pages.filter((p) => p.imageCount > 0 || p.ocrUsed).map((p) => ({
      page: p.page,
      printedPage: p.printedPage,
      charCount: p.charCount,
      imageCount: p.imageCount,
      ocrUsed: p.ocrUsed,
      reviewReasons: p.reviewReasons,
      ocrStart: p.images[0]?.ocrText.slice(0, 200) || "",
    })),
    sparse: pdf.pages.filter((p) => p.charCount < 40).map((p) => p.page),
  }, null, 2), "utf8");
  console.log("PDF", pdf.status, pdf.pageCount, "review", pdf.pages.filter((p) => p.needsReview).length);

  console.log("HWP extract start");
  const hwp = await extractManualFile(hwpBuf, "2025-eval-manual.hwp");
  await writeFile(`${OUT}/official-hwp-extract.json`, JSON.stringify({
    status: hwp.status,
    error: hwp.error,
    pageCount: hwp.pageCount,
    warnings: hwp.warnings,
    charCount: hwp.pages.reduce((n, p) => n + p.charCount, 0),
    tables: hwp.tables.length,
    images: hwp.pages.reduce((n, p) => n + p.images.length, 0),
    textStart: hwp.pages[0]?.text.slice(0, 500) || "",
    reviewReasons: hwp.pages.flatMap((p) => p.reviewReasons).slice(0, 20),
  }, null, 2), "utf8");
  console.log("HWP", hwp.status, hwp.pageCount, hwp.error || "", "chars", hwp.pages.reduce((n, p) => n + p.charCount, 0));

  const cmp = compareExtracts(pdf, hwp);
  await writeFile(`${OUT}/official-compare.json`, JSON.stringify(cmp, null, 2), "utf8");
  console.log("COMPARE", cmp.note, "diffs", cmp.diffs.length);

  const bundle = JSON.parse(await readFile("src/data/manual.json", "utf8")) as {
    indicators: { id: number; name: string; curr: { criteria: string; method: string; law: string; period: string; text: string } }[];
  };
  const fulls = parseIndicatorsFromPages(pdf.pages);
  if (hwp.status !== "failed" && hwp.pages.some((p) => p.charCount > 200)) {
    for (const f of fulls) f.comparedWithHwp = cmp.compared;
  }
  const audit = auditAgainstBundle(fulls, bundle.indicators);
  const missingIds = bundle.indicators.filter((i) => !fulls.some((f) => f.id === i.id)).map((i) => i.id);
  for (const id of missingIds) {
    audit.push({
      id,
      name: bundle.indicators.find((i) => i.id === id)?.name || "",
      filePages: [],
      printedPages: [],
      imagePages: [],
      status: "needs-review",
      missing: ["이 배포본 추출에서 지표를 찾지 못함"],
      reasons: ["확인 필요"],
    });
  }
  await writeFile(`${OUT}/official-audit.json`, JSON.stringify({
    extracted: fulls.length,
    missingIds,
    sameEditionUnconfirmed: true,
    pdfVsHwp: cmp.note,
    items: audit,
  }, null, 2), "utf8");

  await writeFile("data/manual-store/preview.json", JSON.stringify({
    localPreview: true,
    exposeToStaff: false,
    editionLabel: "첨부 2025 평가매뉴얼 PDF 로컬 미리보기 (직원 확정본 아님)",
    pdfSha12: sha(pdfBuf).slice(0, 12),
    pageCount: pdf.pageCount,
    indicators: fulls,
  }, null, 2), "utf8");
  console.log("preview indicators", fulls.length, "missing", missingIds.join(",") || "none-listed");
  void stat;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

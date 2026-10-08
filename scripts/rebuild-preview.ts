import { readFile, writeFile } from "fs/promises";
import { auditAgainstBundle, parseIndicatorsFromPages } from "../src/lib/extract/parseIndicators.ts";
import type { PageExtract } from "../src/lib/extract/types.ts";

async function main() {
  const preview = JSON.parse(await readFile("data/manual-store/preview.json", "utf8")) as {
    indicators: { id: number; raw: string; filePages: number[]; printedPages: number[]; imagePages: number[] }[];
    pdfSha12?: string;
    pageCount?: number;
  };
  const pages: PageExtract[] = [];
  for (const ind of preview.indicators) {
    for (const p of ind.filePages.length ? ind.filePages : [ind.id]) {
      pages.push({
        page: p,
        printedPage: null,
        width: 0,
        height: 0,
        text: ind.raw,
        left: "",
        right: "",
        charCount: ind.raw.replace(/\s/g, "").length,
        imageCount: ind.imagePages.includes(p) ? 1 : 0,
        ocrUsed: ind.imagePages.includes(p),
        needsReview: ind.imagePages.includes(p),
        reviewReasons: [],
        tables: [],
        images: [],
      });
    }
  }
  const fulls = parseIndicatorsFromPages(pages);
  const bundle = JSON.parse(await readFile("src/data/manual.json", "utf8")) as {
    indicators: { id: number; name: string; curr: { criteria: string; method: string; law: string; period: string; text: string } }[];
  };
  const audit = auditAgainstBundle(fulls, bundle.indicators);
  await writeFile("data/manual-store/preview.json", JSON.stringify({
    localPreview: true,
    exposeToStaff: false,
    editionLabel: "첨부 2025 평가매뉴얼 PDF 로컬 미리보기 (직원 확정본 아님)",
    pdfSha12: preview.pdfSha12,
    pageCount: preview.pageCount,
    indicators: fulls,
  }, null, 2), "utf8");
  await writeFile("data/manual-store/test-runs/official-audit.json", JSON.stringify({
    extracted: fulls.length,
    missingIds: bundle.indicators.filter((i) => !fulls.some((f) => f.id === i.id)).map((i) => i.id),
    sameEditionUnconfirmed: true,
    items: audit,
  }, null, 2), "utf8");
  console.log(JSON.stringify({
    n: fulls.length,
    names: fulls.map((f) => ({ id: f.id, name: f.name.slice(0, 24), pages: f.filePages, review: f.needsReview })),
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

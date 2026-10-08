import { readFile, writeFile } from "fs/promises";
import { extractManualFile } from "../src/lib/extract/index.ts";
import { parseIndicatorsFromPages } from "../src/lib/extract/parseIndicators.ts";

async function main() {
  const prev = JSON.parse(await readFile("data/manual-store/preview.json", "utf8")) as {
    indicators: { id: number; imageOcr?: { page: number; text: string; ok: boolean; error?: string }[] }[];
  };
  const ocrByPage = new Map<number, { page: number; text: string; ok: boolean; error?: string }>();
  for (const ind of prev.indicators || []) {
    for (const o of ind.imageOcr || []) ocrByPage.set(o.page, o);
  }
  const pdfBuf = await readFile("data/manual-store/official/2025-eval-manual.pdf");
  const pdf = await extractManualFile(pdfBuf, "2025-eval-manual.pdf");
  const fulls = parseIndicatorsFromPages(pdf.pages);
  for (const f of fulls) {
    f.imageOcr = (f.imagePages || []).map((pg) => ocrByPage.get(pg) || { page: pg, text: "", ok: false, error: "원본 이미지 확인 필요" });
    if (f.imagePages.length) {
      f.needsReview = true;
      f.extractStatus = "needs-review";
      f.reviewReasons.push("이미지 쪽은 OCR과 원본을 함께 두었습니다. 판독이 비면 확인 필요를 유지합니다.");
    }
  }
  await writeFile(
    "data/manual-store/preview.json",
    JSON.stringify(
      {
        localPreview: true,
        exposeToStaff: false,
        editionLabel: "첨부 2025 평가매뉴얼 PDF 로컬 미리보기",
        pageCount: pdf.pageCount,
        indicators: fulls,
      },
      null,
      2
    )
  );
  const of = (id: number) => fulls.find((f) => f.id === id);
  console.log(
    JSON.stringify(
      {
        n: fulls.length,
        i10: { name: of(10)?.name, pages: of(10)?.filePages, images: of(10)?.imagePages },
        i45: { name: of(45)?.name, pages: of(45)?.filePages, rawTail: of(45)?.raw.slice(-80) },
        owner58: fulls.filter((f) => f.filePages.includes(58)).map((f) => f.id),
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

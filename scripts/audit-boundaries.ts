import { mkdir, readFile, writeFile } from "fs/promises";
import { createRequire } from "module";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractHangul } from "../src/lib/extract/hwp.ts";

const req = createRequire(import.meta.url);

async function pdfStarts(path: string) {
  const data = new Uint8Array(await readFile(path));
  const pdf = await getDocument({ data, isEvalSupported: false } as never).promise;
  const hits: { id: number; page: number; snippet: string }[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((it) => ("str" in it ? String(it.str) : "")).join("\n");
    for (const m of text.matchAll(/평가지표\s+(\d+)/g)) {
      hits.push({ id: Number(m[1]), page: i, snippet: text.replace(/\s+/g, " ").slice(0, 80) });
    }
  }
  const byId: Record<number, { start: number; end: number; hits: number[] }> = {};
  for (const h of hits) {
    if (h.id < 1 || h.id > 45) continue;
    if (!byId[h.id]) byId[h.id] = { start: h.page, end: h.page, hits: [] };
    byId[h.id].hits.push(h.page);
    byId[h.id].start = Math.min(byId[h.id].start, h.page);
    byId[h.id].end = Math.max(byId[h.id].end, h.page);
  }
  for (let id = 1; id <= 45; id++) {
    const next = byId[id + 1];
    if (byId[id] && next) byId[id].end = next.start - 1;
  }
  if (byId[45]) byId[45].end = pdf.numPages;
  return { pages: pdf.numPages, byId, missing: [...Array(45)].map((_, i) => i + 1).filter((id) => !byId[id]) };
}

async function renderImages(path: string, pages: number[]) {
  const { createCanvas } = req("@napi-rs/canvas") as { createCanvas: (w: number, h: number) => { getContext: (t: string) => unknown; toBuffer: (t: string) => Buffer } };
  const data = new Uint8Array(await readFile(path));
  const pdf = await getDocument({ data, isEvalSupported: false } as never).promise;
  await mkdir("data/manual-store/page-images", { recursive: true });
  for (const i of pages) {
    const page = await pdf.getPage(i);
    const v = page.getViewport({ scale: 1.3 });
    const canvas = createCanvas(Math.ceil(v.width), Math.ceil(v.height));
    await page.render({ canvasContext: canvas.getContext("2d"), viewport: v } as never).promise;
    await writeFile(`data/manual-store/page-images/pdf-${i}.png`, canvas.toBuffer("image/png"));
  }
}

async function main() {
  const off = await pdfStarts("data/manual-store/official/2025-eval-manual.pdf");
  let dual = null;
  try {
    dual = await pdfStarts("C:/cu/pg/manual.pdf");
  } catch {
    dual = null;
  }
  process.env.MANUAL_SKIP_OCR = "1";
  const hwp = await extractHangul(await readFile("data/manual-store/official/2025-eval-manual.hwp"), "2025-eval-manual.hwp");
  await renderImages("data/manual-store/official/2025-eval-manual.pdf", [48, 53, 55, 56, 57, 58, 59, 60, 79, 150, 151]);
  const out = {
    official205: off,
    dual218: dual ? { pages: dual.pages, i6: dual.byId[6], missing: dual.missing } : null,
    hwp: { status: hwp.status, tables: hwp.tables.length, images: hwp.pages[0]?.images.length, warnings: hwp.warnings.slice(0, 8) },
    note: "218쪽 대비본과 205쪽 단독본은 다른 파일입니다. PDF·HWP는 다른 파일이며 같은 배포본 여부는 미확정입니다.",
  };
  await mkdir("data/manual-store/test-runs", { recursive: true });
  await writeFile("data/manual-store/test-runs/boundaries.json", JSON.stringify(out, null, 2), "utf8");
  console.log(JSON.stringify({ i6: off.byId[6], missing: off.missing, hwpTables: hwp.tables.length, starts: Object.fromEntries(Object.entries(off.byId).map(([k, v]) => [k, v.start])) }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

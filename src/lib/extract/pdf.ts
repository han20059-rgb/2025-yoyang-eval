import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { blocksFromPages, classifyManualText, printedPageOf } from "@/lib/extract/classify";
import { ocrImageBuffer } from "@/lib/extract/ocr";
import type { ExtractedImage, ExtractedTable, FileExtractResult, PageExtract } from "@/lib/extract/types";

type PdfItem = { x: number; y: number; str: string; w: number; h: number };

function joinColumn(arr: PdfItem[]) {
  const sorted = [...arr].sort((a, b) => (Math.abs(a.y - b.y) > 2 ? b.y - a.y : a.x - b.x));
  const lines: string[] = [];
  let curY: number | null = null;
  let cur: PdfItem[] = [];
  for (const it of sorted) {
    if (curY === null || Math.abs(it.y - curY) <= 3) {
      cur.push(it);
      curY = curY === null ? it.y : curY;
    } else {
      lines.push(cur.map((c) => c.str).join(" "));
      cur = [it];
      curY = it.y;
    }
  }
  if (cur.length) lines.push(cur.map((c) => c.str).join(" "));
  return lines.join("\n");
}

function tablesFromItems(page: number, items: PdfItem[]): ExtractedTable[] {
  if (items.length < 8) return [];
  const rows: PdfItem[][] = [];
  const sorted = [...items].sort((a, b) => b.y - a.y);
  let cur: PdfItem[] = [];
  let y: number | null = null;
  for (const it of sorted) {
    if (y === null || Math.abs(it.y - y) <= 4) {
      cur.push(it);
      y = y === null ? it.y : y;
    } else {
      if (cur.length >= 3) rows.push(cur.sort((a, b) => a.x - b.x));
      cur = [it];
      y = it.y;
    }
  }
  if (cur.length >= 3) rows.push(cur.sort((a, b) => a.x - b.x));
  if (rows.length < 3) return [];
  const colCounts = rows.map((r) => r.length);
  const mode = colCounts.sort((a, b) => a - b)[Math.floor(colCounts.length / 2)];
  if (mode < 3) return [];
  const cells = [];
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      cells.push({ r, c, text: rows[r][c].str });
    }
  }
  return [
    {
      id: `pdf-t-${page}`,
      page,
      cells,
      needsReview: true,
      reviewReason: "표는 좌표 추정입니다. 셀 병합·헤더는 원문과 대조하세요.",
    },
  ];
}

function isPdfHeader(buf: Buffer) {
  return buf.subarray(0, 5).toString("utf8") === "%PDF-";
}

function isEncryptedHint(buf: Buffer) {
  return buf.includes(Buffer.from("/Encrypt"));
}

export async function extractPdf(buf: Buffer, fileName: string): Promise<FileExtractResult> {
  const warnings: string[] = [];
  if (!isPdfHeader(buf)) {
    return fail("pdf", fileName, "PDF 시그니처가 없습니다. 지원하지 않는 파일이거나 손상되었을 수 있습니다.");
  }
  if (isEncryptedHint(buf)) {
    warnings.push("암호화 관련 항목이 보입니다. 열리지 않으면 암호를 해제한 뒤 다시 등록하세요.");
  }

  let pdf;
  try {
    pdf = await getDocument({ data: new Uint8Array(buf), isEvalSupported: false } as Parameters<typeof getDocument>[0]).promise;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const encrypted = /password|encrypt/i.test(msg);
    return fail("pdf", fileName, encrypted ? "암호화된 PDF는 읽지 못했습니다." : `PDF를 열지 못했습니다: ${msg}`);
  }

  const pages: PageExtract[] = [];
  const allTables: ExtractedTable[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const midX = viewport.width / 2;
    const left: PdfItem[] = [];
    const right: PdfItem[] = [];
    const all: PdfItem[] = [];
    for (const raw of content.items) {
      const item = raw as { str?: string; transform: number[]; width: number; height: number };
      const str = (item.str || "").trim();
      if (!str) continue;
      const rec = { x: item.transform[4], y: item.transform[5], str, w: item.width, h: item.height };
      all.push(rec);
      if (rec.x < midX) left.push(rec);
      else right.push(rec);
    }
    const leftText = joinColumn(left);
    const rightText = joinColumn(right);
    const fullText = joinColumn(all);

    const ops = await page.getOperatorList();
    let imageCount = 0;
    const images: ExtractedImage[] = [];
    for (let k = 0; k < ops.fnArray.length; k++) {
      const fn = ops.fnArray[k];
      if (fn === 85 || fn === 86 || fn === 87) imageCount += 1;
    }

    const charCount = fullText.replace(/\s/g, "").length;
    const printed = printedPageOf(fullText);
    const sparse = charCount < 40;
    const hasImage = imageCount > 0;
    const reviewReasons: string[] = [];
    let ocrUsed = false;
    let text = fullText;
    let ocrLeft = leftText;
    let ocrRight = rightText;

    if (hasImage) {
      reviewReasons.push(
        `이미지가 ${imageCount}개 포함되어 있습니다. 글자가 있어도 그림·표 이미지는 OCR로 보완합니다.`
      );
    }
    if (sparse) {
      reviewReasons.push("추출된 글자가 매우 적습니다. 빈 페이지가 아니면 확인이 필요합니다.");
    }

    if ((sparse || hasImage) && process.env.MANUAL_SKIP_OCR !== "1") {
      try {
        const png = await renderPagePng(page as never, viewport);
        if (png) {
          const storedRel = await storePdfPageImage(i, png);
          const ocr = await ocrImageBuffer(png, `${fileName} ${i}쪽`);
          ocrUsed = true;
          if (ocr.ok) {
            text = [fullText, ocr.text].filter(Boolean).join("\n");
            ocrRight = ocr.text;
          } else {
            reviewReasons.push(ocr.error || "OCR 실패");
          }
          images.push({
            id: `p${i}-ocr`,
            page: i,
            ocrText: ocr.text,
            ocrRan: true,
            storedRel,
            needsReview: true,
            reviewReason: ocr.ok ? "이미지 페이지 OCR 결과입니다. 원문과 대조하세요." : `${ocr.error || "OCR 실패"} · 원본 이미지는 화면에 둡니다.`,
          });
        } else {
          reviewReasons.push("페이지 이미지를 렌더하지 못해 OCR을 완료하지 못했습니다.");
        }
      } catch (err) {
        reviewReasons.push(`페이지 렌더/OCR 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else if ((sparse || hasImage) && process.env.MANUAL_SKIP_OCR === "1") {
      images.push({
        id: `p${i}-img`,
        page: i,
        ocrText: "",
        ocrRan: true,
        storedRel: `pdf-${i}.png`,
        needsReview: true,
        reviewReason: "OCR를 건너뛰었습니다. 원본 페이지 이미지는 별도 저장합니다.",
      });
    }

    const tables = tablesFromItems(i, all);
    allTables.push(...tables);
    const needsReview = reviewReasons.length > 0;
    pages.push({
      page: i,
      printedPage: printed,
      width: viewport.width,
      height: viewport.height,
      text,
      left: ocrLeft,
      right: ocrRight,
      charCount: text.replace(/\s/g, "").length,
      imageCount,
      ocrUsed,
      needsReview,
      reviewReasons,
      tables,
      images,
    });
  }

  const emptyPages = pages.filter((p) => p.charCount === 0);
  const failedOcr = pages.filter((p) => p.needsReview && p.charCount === 0);
  let status: FileExtractResult["status"] = "complete";
  if (pages.length === 0 || pages.every((p) => p.charCount === 0)) {
    return fail("pdf", fileName, "본문을 하나도 읽지 못했습니다. 빈 결과를 완료로 처리하지 않습니다.");
  }
  if (emptyPages.length || pages.some((p) => p.needsReview)) status = "partial";
  if (failedOcr.length) {
    warnings.push(`글자를 읽지 못한 페이지 ${failedOcr.map((p) => p.page).join(", ")}쪽`);
  }
  warnings.push("두 형식을 함께 등록하지 않으면 대조하지 않습니다.");

  const blocks = blocksFromPages(pages);
  const classified = classifyManualText(pages.map((p) => p.text).join("\n"));

  return {
    format: "pdf",
    fileName,
    status,
    warnings,
    pageCount: pages.length,
    pages,
    blocks,
    tables: allTables,
    classified,
    classifiedIsInterpretation: true,
    comparedWithOtherFormat: false,
  };
}

async function storePdfPageImage(page: number, png: Buffer) {
  const dir = join(process.cwd(), "data", "manual-store", "page-images");
  await mkdir(dir, { recursive: true });
  const rel = `pdf-${page}.png`;
  await writeFile(join(dir, rel), png);
  return rel;
}

export async function saveSelectedPdfPageImages(buf: Buffer, pagesWanted: number[]) {
  const want = new Set(pagesWanted);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdf = await getDocument({ data: new Uint8Array(buf), disableWorker: true } as never).promise;
  const saved: string[] = [];
  for (const i of [...want].sort((a, b) => a - b)) {
    if (i < 1 || i > pdf.numPages) continue;
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const png = await renderPagePng(page as never, viewport);
    if (png) saved.push(await storePdfPageImage(i, png));
  }
  return saved;
}

async function renderPagePng(page: { getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: { canvasContext: unknown; viewport: unknown }) => { promise: Promise<unknown> } }, viewport: { width: number; height: number }) {
  try {
    const { createRequire } = await import("module");
    const req = createRequire(import.meta.url);
    const { createCanvas } = req("@napi-rs/canvas") as { createCanvas: (w: number, h: number) => { getContext: (t: string) => unknown; toBuffer: (t: string) => Buffer } };
    const scale = 1.4;
    const v = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(v.width), Math.ceil(v.height));
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport: v }).promise;
    return canvas.toBuffer("image/png");
  } catch {
    void viewport;
    return null;
  }
}

function fail(format: "pdf", fileName: string, error: string): FileExtractResult {
  return {
    format,
    fileName,
    status: "failed",
    error,
    warnings: [error],
    pageCount: 0,
    pages: [],
    blocks: [],
    tables: [],
    classified: { criteria: "", scores: "", method: "", period: "", frequency: "", deadline: "", exceptions: "", law: "" },
    classifiedIsInterpretation: true,
    comparedWithOtherFormat: false,
  };
}

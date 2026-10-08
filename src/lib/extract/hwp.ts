import { inflate, inflateRaw } from "zlib";
import { promisify } from "util";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import JSZip from "jszip";
import { find as cfbFind, read as cfbRead } from "cfb";
import { blocksFromPages, classifyManualText, printedPageOf } from "@/lib/extract/classify";
import { ocrImageBuffer } from "@/lib/extract/ocr";
import type { ExtractedImage, ExtractedTable, FileExtractResult, PageExtract } from "@/lib/extract/types";

const inflateAsync = promisify(inflate);
const inflateRawAsync = promisify(inflateRaw);

/** HWP 5 BodyText: HWPTAG_BEGIN(0x10) + n */
const HWPTAG_PARA_TEXT = 0x10 + 51; // 67 0x43
const HWPTAG_CTRL_HEADER = 0x10 + 55; // 71 0x47
const HWPTAG_LIST_HEADER = 0x10 + 56; // 72 0x48
const HWPTAG_TABLE = 0x10 + 61; // 77 0x4D
const HWPTAG_SHAPE_COMPONENT_PICTURE = 0x10 + 69; // 85 0x55

function fail(format: "hwp" | "hwpx", fileName: string, error: string): FileExtractResult {
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

function packResult(
  format: "hwp" | "hwpx",
  fileName: string,
  pages: PageExtract[],
  tables: ExtractedTable[],
  extraWarnings: string[]
): FileExtractResult {
  const warnings = [...extraWarnings];
  if (pages.every((p) => p.charCount === 0) && !pages.some((p) => p.images.some((i) => i.ocrText))) {
    return fail(format, fileName, "본문을 하나도 읽지 못했습니다. 빈 결과를 완료로 처리하지 않습니다.");
  }
  if ((format === "hwp" || format === "hwpx") && tables.length === 0) {
    warnings.push("HWP 표 셀 0건은 정상 추출이 아닙니다.");
    return {
      format,
      fileName,
      status: "failed",
      error: "표를 한 칸도 읽지 못했습니다. 0건을 완료로 처리하지 않습니다.",
      warnings,
      pageCount: pages.length,
      pages,
      blocks: blocksFromPages(pages),
      tables,
      classified: classifyManualText(pages.map((p) => p.text).join("\n")),
      classifiedIsInterpretation: true,
      comparedWithOtherFormat: false,
    };
  }
  if (tables.some((t) => t.cells.length > 400)) {
    warnings.push("셀 400개를 넘는 표가 남아 부분 추출·검토 필요로 둡니다. 한도를 올려 통과시키지 않았습니다.");
  }
  const status = pages.some((p) => p.needsReview) || warnings.length || tables.some((t) => t.cells.length > 400) ? "partial" : "complete";
  warnings.push("두 형식을 함께 등록하지 않으면 대조하지 않습니다.");
  return {
    format,
    fileName,
    status,
    warnings,
    pageCount: pages.length,
    pages,
    blocks: blocksFromPages(pages),
    tables,
    classified: classifyManualText(pages.map((p) => p.text).join("\n")),
    classifiedIsInterpretation: true,
    comparedWithOtherFormat: false,
  };
}

/** HWP 5 PARA_TEXT: CHAR(2B) vs INLINE/EXTENDED(16B). Not every code 1–31 is 16 bytes. */
const PARA_CHAR_2BYTE = new Set([0, 10, 13, 24, 25, 30, 31]);
const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮";

function decodeParaText(data: Buffer): string {
  const chars: string[] = [];
  for (let i = 0; i + 1 < data.length; i += 2) {
    const code = data.readUInt16LE(i);
    if (code >= 32) {
      chars.push(String.fromCharCode(code));
      continue;
    }
    if (PARA_CHAR_2BYTE.has(code)) {
      if (code === 10 || code === 13) chars.push("\n");
      else if (code === 30) chars.push(" ");
      else if (code === 24 || code === 25) chars.push("-");
      continue;
    }
    if (code >= 1 && code <= 31) {
      if (i + 16 <= data.length) {
        if (code === 19) {
          const kind = data.readUInt16LE(i + 2);
          const n = data.readUInt16LE(i + 4);
          if (kind === 0 && n >= 1 && n <= 15) chars.push(CIRCLED[n - 1] || String(n));
          else if (n >= 1 && n <= 15) chars.push(CIRCLED[n - 1] || "");
        } else if (code === 9) chars.push("\t");
        i += 14;
      }
      continue;
    }
  }
  return chars.join("").replace(/[ \t]+\n/g, "\n").trim();
}

function ctrlId(data: Buffer) {
  if (data.length < 4) return "";
  return data.toString("latin1", 0, 4);
}

function isTableCtrl(id: string) {
  const s = id.replace(/\0/g, "");
  const rev = s.split("").reverse().join("");
  return s === "tbl " || s === "tbl" || s === " lbt" || rev === "tbl " || rev === "tbl";
}

function parseRecords(buf: Buffer) {
  const texts: string[] = [];
  const tableGroups: { cells: { r: number; c: number; text: string; rowSpan?: number; colSpan?: number }[] }[] = [];
  const ctrlIds: string[] = [];
  const tagCounts: Record<number, number> = {};
  let offset = 0;
  type Cell = { r: number; c: number; text: string; rowSpan?: number; colSpan?: number };
  type Frame = {
    level: number;
    nRow: number;
    nCol: number;
    pending: { r: number; c: number; rowSpan: number; colSpan: number };
    cells: Cell[];
    occupied: Set<string>;
  };
  const stack: Frame[] = [];
  let records = 0;
  const flush = (frame: Frame) => {
    if (frame.cells.length) tableGroups.push({ cells: frame.cells });
    frame.cells = [];
    frame.occupied = new Set();
  };
  const popTables = (level: number) => {
    while (stack.length && level <= stack[stack.length - 1].level) {
      const frame = stack.pop();
      if (frame) flush(frame);
    }
  };
  while (offset + 4 <= buf.length) {
    const header = buf.readUInt32LE(offset);
    offset += 4;
    const tag = header & 0x3ff;
    const level = (header >>> 10) & 0x3ff;
    let size = header >>> 20;
    if (size === 0xfff) {
      if (offset + 4 > buf.length) break;
      size = buf.readUInt32LE(offset);
      offset += 4;
    }
    if (size > buf.length || offset + size > buf.length) break;
    records += 1;
    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    popTables(level);
    const data = buf.subarray(offset, offset + size);
    offset += size;
    const top = stack[stack.length - 1];
    if (tag === HWPTAG_CTRL_HEADER && data.length >= 4) {
      const id = ctrlId(data);
      if (ctrlIds.length < 80) ctrlIds.push(id);
      if (isTableCtrl(id)) {
        stack.push({
          level,
          nRow: 0,
          nCol: 0,
          pending: { r: 0, c: 0, rowSpan: 1, colSpan: 1 },
          cells: [],
          occupied: new Set(),
        });
      }
    } else if (tag === HWPTAG_TABLE && data.length >= 8 && top) {
      top.nRow = data.readUInt16LE(4);
      top.nCol = Math.max(1, data.readUInt16LE(6) || 1);
    } else if (tag === HWPTAG_LIST_HEADER && top && data.length >= 14) {
      const colAddr = data.readUInt16LE(6);
      const rowAddr = data.readUInt16LE(8);
      const colSpan = data.readUInt16LE(10);
      const rowSpan = data.readUInt16LE(12);
      const nCol = top.nCol || 40;
      const nRow = top.nRow || 80;
      const isCell = colSpan >= 1 && rowSpan >= 1 && colAddr < nCol && rowAddr < nRow && colAddr + colSpan <= nCol + 2 && rowAddr + rowSpan <= nRow + 2;
      if (!isCell) continue;
      const key = `${rowAddr},${colAddr}`;
      if ((top.nRow > 80 || top.nRow * top.nCol > 400) && top.occupied.has(key)) flush(top);
      top.occupied.add(key);
      top.pending = { r: rowAddr, c: colAddr, rowSpan, colSpan };
    } else if (tag === HWPTAG_PARA_TEXT) {
      const t = decodeParaText(data);
      if (!t) continue;
      if (top) {
        const prev = top.cells[top.cells.length - 1];
        if (prev && prev.r === top.pending.r && prev.c === top.pending.c) prev.text = `${prev.text}\n${t}`;
        else top.cells.push({ r: top.pending.r, c: top.pending.c, text: t, rowSpan: top.pending.rowSpan, colSpan: top.pending.colSpan });
      } else texts.push(t);
    }
  }
  while (stack.length) {
    const frame = stack.pop();
    if (frame) flush(frame);
  }
  return { texts, tableGroups, ctrlIds, tagCounts, records };
}

async function maybeInflate(buf: Buffer, compressed: boolean) {
  if (!compressed) return buf;
  try {
    return await inflateRawAsync(buf);
  } catch {
    try {
      return await inflateAsync(buf);
    } catch {
      try {
        return await inflateAsync(buf.subarray(2));
      } catch {
        return buf;
      }
    }
  }
}

export async function extractHangul(buf: Buffer, fileName: string): Promise<FileExtractResult> {
  if (buf.subarray(0, 2).toString("utf8") === "PK") {
    return extractHwpx(buf, fileName);
  }
  return extractHwp5(buf, fileName);
}

async function extractHwp5(buf: Buffer, fileName: string): Promise<FileExtractResult> {
  let cfb;
  try {
    cfb = cfbRead(buf, { type: "buffer" });
  } catch (err) {
    return fail("hwp", fileName, `HWP(OLE) 컨테이너를 열지 못했습니다: ${err instanceof Error ? err.message : String(err)}`);
  }
  const headerEntry = cfbFind(cfb, "FileHeader");
  if (!headerEntry || !headerEntry.content) {
    return fail("hwp", fileName, "HWP FileHeader가 없습니다. 지원하지 않는 버전이거나 손상된 파일입니다.");
  }
  const header = Buffer.from(headerEntry.content as Uint8Array);
  const sig = header.subarray(0, 32).toString("utf8");
  if (!/HWP Document File/.test(sig)) {
    return fail("hwp", fileName, "아래한글 5.x 시그니처가 아닙니다.");
  }
  const flags = header.length >= 38 ? header.readUInt32LE(36) : 0;
  const compressed = (flags & 0x01) !== 0;
  const encrypted = (flags & 0x02) !== 0;
  if (encrypted) {
    return fail("hwp", fileName, "암호화된 HWP는 읽지 못했습니다.");
  }

  const sectionNames = cfb.FileIndex.map((f) => f.name).filter((n) => /BodyText\/Section/i.test(n) || /^Section\d+/i.test(n));
  const bodyEntries = cfb.FullPaths.filter((p) => /BodyText[\\/]+Section/i.test(p));
  const paths = bodyEntries.length ? bodyEntries : sectionNames;
  if (paths.length === 0) {
    return fail("hwp", fileName, "BodyText 섹션을 찾지 못했습니다.");
  }

  const warnings: string[] = [];
  const allText: string[] = [];
  const tableCells: ExtractedTable[] = [];
  const images: ExtractedImage[] = [];
  const ctrlSample: string[] = [];
  const tagSample: Record<number, number> = {};

  for (const path of paths) {
    const entry = cfbFind(cfb, path);
    if (!entry?.content) continue;
    const raw = Buffer.from(entry.content as Uint8Array);
    const data = await maybeInflate(raw, compressed);
    const parsed = parseRecords(data);
    allText.push(...parsed.texts);
    ctrlSample.push(...parsed.ctrlIds);
    for (const [k, v] of Object.entries(parsed.tagCounts)) {
      const n = Number(k);
      tagSample[n] = (tagSample[n] || 0) + v;
    }
    parsed.tableGroups.forEach((g, gi) => {
      if (!g.cells.length) return;
      const oversized = g.cells.length > 400;
      tableCells.push({
        id: `hwp-${path}-${gi}`,
        page: 1,
        cells: g.cells,
        needsReview: true,
        reviewReason: oversized
          ? `표 셀 ${g.cells.length}개. 400셀을 넘어 잘못 합쳐졌거나 원본이 큰 표입니다. 완료로 보지 않습니다.`
          : "HWP 표 셀 행·열은 LIST_HEADER 주소와 병합 칸으로 복원했습니다. 확인하세요.",
      });
      allText.push(g.cells.map((c) => c.text).join("\t"));
    });
  }

  const binPaths = cfb.FullPaths.filter((p) => /BinData/i.test(p));
  for (const path of binPaths) {
    const entry = cfbFind(cfb, path);
    if (!entry?.content) continue;
    const raw = Buffer.from(entry.content as Uint8Array);
    const payload = await maybeInflate(raw, compressed);
    const isImg = payload[0] === 0xff && payload[1] === 0xd8;
    const isPng = payload[0] === 0x89 && payload[1] === 0x50;
    if (!isImg && !isPng) continue;
    const storedRel = await storeBinImage(path, payload, isPng ? "png" : "jpg");
    const skip = process.env.MANUAL_SKIP_OCR === "1";
    const ocr = skip
      ? { text: "", ok: false, error: `${fileName} ${path}: OCR를 건너뛰고 원본 이미지만 저장했습니다.` }
      : await ocrImageBuffer(payload, `${fileName} ${path}`);
    images.push({
      id: path,
      page: 1,
      ocrText: ocr.text,
      ocrRan: true,
      storedRel,
      needsReview: true,
      reviewReason: ocr.ok ? "HWP 포함 이미지 OCR입니다. 확인 필요" : `${ocr.error || "이미지 OCR 실패"} · 원본 이미지는 화면에 둡니다.`,
    });
    if (ocr.ok) allText.push(ocr.text);
    else warnings.push(ocr.error || "이미지 OCR 실패");
  }

  if (tableCells.length === 0) {
    warnings.push(
      `HWP 표 셀 0건. 태그 CTRL=0x47:${tagSample[0x47] || 0} LIST=0x48:${tagSample[0x48] || 0} TABLE=0x4d:${tagSample[0x4d] || 0}. 제어 ID: ${[...new Set(ctrlSample)].slice(0, 20).join("|") || "없음"}`
    );
  }
  const full = allText.filter(Boolean).join("\n");
  if (!full && images.length === 0) {
    return fail("hwp", fileName, "HWP 본문 레코드를 해석하지 못했습니다.");
  }
  const page: PageExtract = {
    page: 1,
    printedPage: printedPageOf(full),
    width: 0,
    height: 0,
    text: full,
    left: full,
    right: "",
    charCount: full.replace(/\s/g, "").length,
    imageCount: images.length,
    ocrUsed: images.some((i) => i.ocrRan),
    needsReview: images.length > 0 || tableCells.length > 0,
    reviewReasons: [
      "HWP는 페이지 경계가 PDF와 다릅니다. 쪽 번호는 본문 표기를 따릅니다.",
      ...images.map((i) => i.reviewReason),
    ],
    tables: tableCells,
    images,
  };
  return packResult("hwp", fileName, [page], tableCells, warnings);
}

async function storeBinImage(path: string, payload: Buffer, ext: string) {
  const dir = join(process.cwd(), "data", "manual-store", "page-images");
  await mkdir(dir, { recursive: true });
  const safe = path.replace(/[^\w.\-]+/g, "_").slice(-40);
  const rel = `hwp-${safe}.${ext}`;
  await writeFile(join(dir, rel), payload);
  return rel;
}

async function extractHwpx(buf: Buffer, fileName: string): Promise<FileExtractResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch (err) {
    return fail("hwpx", fileName, `HWPX(ZIP)를 열지 못했습니다: ${err instanceof Error ? err.message : String(err)}`);
  }
  const sectionFiles = Object.keys(zip.files).filter((n) => /Contents\/section\d+\.xml$/i.test(n));
  if (sectionFiles.length === 0) {
    return fail("hwpx", fileName, "HWPX Contents/section XML이 없습니다.");
  }
  const texts: string[] = [];
  const tables: ExtractedTable[] = [];
  const images: ExtractedImage[] = [];
  const warnings: string[] = [];

  for (const name of sectionFiles.sort()) {
    const xml = await zip.files[name].async("string");
    const textBits = [...xml.matchAll(/<(?:hp:)?t\b[^>]*>([\s\S]*?)<\/(?:hp:)?t>/g)].map((m) =>
      m[1].replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    );
    texts.push(textBits.join(""));
    const tbls = xml.split(/<(?:hp:)?tbl\b/i).slice(1);
    tbls.forEach((chunk, idx) => {
      const cells = [...chunk.matchAll(/<(?:hp:)?t\b[^>]*>([\s\S]*?)<\/(?:hp:)?t>/g)].map((m, i) => ({
        r: i,
        c: 0,
        text: m[1].replace(/<[^>]+>/g, ""),
      }));
      if (cells.length) {
        tables.push({
          id: `${name}-${idx}`,
          page: 1,
          cells,
          needsReview: true,
          reviewReason: "HWPX 표 셀 관계는 XML 순서 기준입니다. 병합 셀은 확인하세요.",
        });
      }
    });
  }

  const binFiles = Object.keys(zip.files).filter((n) => /BinData\//i.test(n));
  for (const name of binFiles) {
    const payload = Buffer.from(await zip.files[name].async("uint8array"));
    const isImg = (payload[0] === 0xff && payload[1] === 0xd8) || (payload[0] === 0x89 && payload[1] === 0x50);
    if (!isImg) continue;
    const ocr = await ocrImageBuffer(payload, `${fileName} ${name}`);
    images.push({
      id: name,
      page: 1,
      ocrText: ocr.text,
      ocrRan: true,
      needsReview: true,
      reviewReason: ocr.ok ? "HWPX 포함 이미지 OCR입니다. 확인 필요" : ocr.error || "이미지 OCR 실패",
    });
    if (ocr.ok) texts.push(ocr.text);
    else warnings.push(ocr.error || "이미지 OCR 실패");
  }

  const full = texts.filter(Boolean).join("\n");
  const page: PageExtract = {
    page: 1,
    printedPage: printedPageOf(full),
    width: 0,
    height: 0,
    text: full,
    left: full,
    right: "",
    charCount: full.replace(/\s/g, "").length,
    imageCount: images.length,
    ocrUsed: images.some((i) => i.ocrRan),
    needsReview: true,
    reviewReasons: ["HWPX 페이지 경계는 원문 쪽 표기를 확인하세요.", ...images.map((i) => i.reviewReason)],
    tables,
    images,
  };
  return packResult("hwpx", fileName, [page], tables, warnings);
}

import { readFile } from "fs/promises";
import { inflateRaw } from "zlib";
import { promisify } from "util";
import { find as cfbFind, read as cfbRead } from "cfb";

const inflateRawAsync = promisify(inflateRaw);

async function main() {
  const buf = await readFile("data/manual-store/official/2025-eval-manual.hwp");
  const cfb = cfbRead(buf, { type: "buffer" });
  const header = Buffer.from(cfbFind(cfb, "FileHeader")!.content as Uint8Array);
  const compressed = (header.readUInt32LE(36) & 1) !== 0;
  const path = cfb.FullPaths.find((p) => /BodyText[\\/]+Section/i.test(p))!;
  let data = Buffer.from(cfbFind(cfb, path)!.content as Uint8Array);
  if (compressed) data = await inflateRawAsync(data);
  let offset = 0;
  let rec = 0;
  let inGiant = false;
  let nRow = 0;
  let nCol = 0;
  const cells: { r: number; c: number; cs: number; rs: number; bits: number; nPara: number; text: string }[] = [];
  let pending: { r: number; c: number; cs: number; rs: number; bits: number; nPara: number } | null = null;
  while (offset + 4 <= data.length) {
    const h = data.readUInt32LE(offset);
    offset += 4;
    const tag = h & 0x3ff;
    const level = (h >>> 10) & 0x3ff;
    let size = h >>> 20;
    if (size === 0xfff) {
      size = data.readUInt32LE(offset);
      offset += 4;
    }
    if (offset + size > data.length) break;
    rec += 1;
    const payload = data.subarray(offset, offset + size);
    offset += size;
    if (rec === 33070) inGiant = true;
    if (!inGiant) continue;
    if (tag === 0x47 && rec > 33070 && level <= 1) break;
    if (tag === 0x4d && payload.length >= 8) {
      nRow = payload.readUInt16LE(4);
      nCol = payload.readUInt16LE(6);
    } else if (tag === 0x48 && payload.length >= 14 && level === 2) {
      const nPara = payload.readUInt16LE(0);
      const bits = payload.readUInt32LE(2);
      const c = payload.readUInt16LE(6);
      const r = payload.readUInt16LE(8);
      const cs = payload.readUInt16LE(10);
      const rs = payload.readUInt16LE(12);
      pending = { r, c, cs, rs, bits, nPara };
    } else if (tag === 0x43 && pending) {
      const t = payload.toString("utf16le").replace(/[\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
      cells.push({ ...pending, text: t });
      pending = null;
    }
  }
  const headerHits = cells.filter((c) => /평가영역|세부영역|지표번호/.test(c.text));
  const invalid = cells.filter((c) => c.cs < 1 || c.rs < 1 || c.c >= nCol || c.r >= nRow || c.c + c.cs > nCol + 3);
  const row0 = cells.filter((c) => c.r === 0).slice(0, 20);
  const uniqueRows = new Set(cells.map((c) => c.r));
  console.log(
    JSON.stringify(
      {
        nRow,
        nCol,
        cells: cells.length,
        uniqueRows: uniqueRows.size,
        headerHits: headerHits.length,
        headerSample: headerHits.slice(0, 15).map((c) => ({ r: c.r, c: c.c, cs: c.cs, bits: c.bits.toString(16), t: c.text })),
        invalid: invalid.length,
        invalidSample: invalid.slice(0, 8),
        row0,
        maxR: Math.max(...cells.map((c) => c.r)),
      },
      null,
      2
    )
  );
}

main();

import { readFile } from "fs/promises";
import { inflate, inflateRaw } from "zlib";
import { promisify } from "util";
import { find as cfbFind, read as cfbRead } from "cfb";

const inflateAsync = promisify(inflate);
const inflateRawAsync = promisify(inflateRaw);
const HWPTAG_PARA_TEXT = 0x43;
const HWPTAG_CTRL_HEADER = 0x47;
const HWPTAG_LIST_HEADER = 0x48;
const HWPTAG_TABLE = 0x4d;

function ctrlId(data: Buffer) {
  return data.length >= 4 ? data.toString("latin1", 0, 4) : "";
}
function isTableCtrl(id: string) {
  const s = id.replace(/\0/g, "");
  const rev = s.split("").reverse().join("");
  return s === "tbl " || s === "tbl" || s === " lbt" || rev === "tbl " || rev === "tbl";
}

async function maybeInflate(buf: Buffer, compressed: boolean) {
  if (!compressed) return buf;
  try {
    return await inflateRawAsync(buf);
  } catch {
    try {
      return await inflateAsync(buf);
    } catch {
      return buf;
    }
  }
}

async function main() {
  const buf = await readFile("data/manual-store/official/2025-eval-manual.hwp");
  const cfb = cfbRead(buf, { type: "buffer" });
  const header = Buffer.from(cfbFind(cfb, "FileHeader")!.content as Uint8Array);
  const compressed = (header.readUInt32LE(36) & 1) !== 0;
  const paths = cfb.FullPaths.filter((p) => /BodyText[\\/]+Section/i.test(p));
  for (const path of paths) {
    const entry = cfbFind(cfb, path);
    if (!entry?.content) continue;
    const data = await maybeInflate(Buffer.from(entry.content as Uint8Array), compressed);
    type Frame = {
      startRec: number;
      level: number;
      nRow: number;
      nCol: number;
      cells: { r: number; c: number; text: string }[];
      listHits: number;
      listRejected: number;
    };
    const stack: Frame[] = [];
    const tables: Frame[] = [];
    let rec = 0;
    let offset = 0;
    const pop = (level: number) => {
      while (stack.length && level <= stack[stack.length - 1].level) {
        tables.push(stack.pop()!);
      }
    };
    while (offset + 4 <= data.length) {
      const header32 = data.readUInt32LE(offset);
      offset += 4;
      const tag = header32 & 0x3ff;
      const level = (header32 >>> 10) & 0x3ff;
      let size = header32 >>> 20;
      if (size === 0xfff) {
        size = data.readUInt32LE(offset);
        offset += 4;
      }
      if (offset + size > data.length) break;
      rec += 1;
      pop(level);
      const payload = data.subarray(offset, offset + size);
      offset += size;
      const top = stack[stack.length - 1];
      if (tag === HWPTAG_CTRL_HEADER && payload.length >= 4 && isTableCtrl(ctrlId(payload))) {
        stack.push({ startRec: rec, level, nRow: 0, nCol: 0, cells: [], listHits: 0, listRejected: 0 });
      } else if (tag === HWPTAG_TABLE && top && payload.length >= 8) {
        top.nRow = payload.readUInt16LE(4);
        top.nCol = payload.readUInt16LE(6);
      } else if (tag === HWPTAG_LIST_HEADER && top && payload.length >= 10) {
        const colAddr = payload.readUInt16LE(6);
        const rowAddr = payload.length >= 12 ? payload.readUInt16LE(8) : 0;
        const inRange = top.nCol > 0 && top.nRow > 0 ? colAddr < top.nCol && rowAddr < top.nRow : colAddr < 40 && rowAddr < 80;
        if (inRange) {
          top.listHits += 1;
          top.cells.push({ r: rowAddr, c: colAddr, text: "" });
        } else top.listRejected += 1;
      } else if (tag === HWPTAG_PARA_TEXT && top && top.cells.length) {
        const last = top.cells[top.cells.length - 1];
        if (last && !last.text) last.text = payload.toString("utf16le").replace(/[\u0000-\u001f]/g, " ").slice(0, 80);
      }
    }
    while (stack.length) tables.push(stack.pop()!);
    const sized = tables.map((t, i) => ({
      i,
      startRec: t.startRec,
      level: t.level,
      nRow: t.nRow,
      nCol: t.nCol,
      expected: t.nRow * t.nCol,
      listHits: t.listHits,
      listRejected: t.listRejected,
      cells: t.cells.length,
      first: t.cells.slice(0, 3).map((c) => `${c.r},${c.c}:${c.text.slice(0, 24)}`),
      last: t.cells.slice(-2).map((c) => `${c.r},${c.c}:${c.text.slice(0, 24)}`),
    }));
    sized.sort((a, b) => b.cells - a.cells);
    console.log(JSON.stringify({ path, rec, tables: sized.length, top: sized.slice(0, 8), over400: sized.filter((t) => t.cells > 400) }, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

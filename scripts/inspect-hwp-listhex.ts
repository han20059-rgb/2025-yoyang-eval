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
  const rows: string[] = [];
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
    if (tag === 0x48 && level === 2) {
      rows.push(`R${rec} L${level} len=${payload.length} hex=${payload.subarray(0, Math.min(40, payload.length)).toString("hex")}`);
      if (rows.length >= 25) break;
    }
  }
  console.log(rows.join("\n"));
}

main();

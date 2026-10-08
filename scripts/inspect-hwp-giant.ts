import { readFile } from "fs/promises";
import { inflate, inflateRaw } from "zlib";
import { promisify } from "util";
import { find as cfbFind, read as cfbRead } from "cfb";

const inflateAsync = promisify(inflate);
const inflateRawAsync = promisify(inflateRaw);

function ctrlId(data: Buffer) {
  return data.length >= 4 ? data.toString("latin1", 0, 4) : "";
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
  const path = cfb.FullPaths.find((p) => /BodyText[\\/]+Section/i.test(p))!;
  const data = await maybeInflate(Buffer.from(cfbFind(cfb, path)!.content as Uint8Array), compressed);
  let offset = 0;
  let rec = 0;
  const events: string[] = [];
  let inGiant = false;
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
    if (inGiant && rec > 33070 + 4000) break;
    if (!inGiant) continue;
    if (tag === 0x47) {
      const id = ctrlId(payload);
      events.push(`R${rec} L${level} CTRL ${JSON.stringify(id)}`);
    } else if (tag === 0x4d) {
      events.push(`R${rec} L${level} TABLE nRow=${payload.readUInt16LE(4)} nCol=${payload.readUInt16LE(6)} hex=${payload.subarray(0, 16).toString("hex")}`);
    } else if (tag === 0x48 && payload.length >= 14) {
      const nPara = payload.readUInt16LE(0);
      const bits = payload.readUInt32LE(2);
      const c = payload.readUInt16LE(6);
      const r = payload.readUInt16LE(8);
      const cs = payload.readUInt16LE(10);
      const rs = payload.readUInt16LE(12);
      if (r === 0 && c <= 5) events.push(`R${rec} L${level} LIST nPara=${nPara} bits=${bits.toString(16)} r=${r} c=${c} span=${rs}x${cs}`);
    }
  }
  console.log(events.slice(0, 80).join("\n"));
  console.log("---count", events.length);
}

main();

import { readFile } from "fs/promises";
import { inflateSync } from "zlib";
import { find, read } from "cfb";

async function main() {
const buf = await readFile(process.argv[2]);
const cfb = read(buf, { type: "buffer" });
console.log("paths", cfb.FullPaths.slice(0, 80));
console.log("names", cfb.FileIndex.map((f) => f.name).slice(0, 80));
const header = find(cfb, "FileHeader");
if (header?.content) {
  const h = Buffer.from(header.content as Uint8Array);
  console.log("sig", h.subarray(0, 32).toString("utf8"));
  console.log("ver", h.readUInt32LE(32), "flags", h.length >= 38 ? h.readUInt32LE(36) : null, "len", h.length);
}
for (const p of cfb.FullPaths) {
  if (!/section|body|prvtext|docinfo/i.test(p)) continue;
  const e = find(cfb, p);
  if (!e?.content) continue;
  const raw = Buffer.from(e.content as Uint8Array);
  console.log("entry", p, "size", raw.length, "head", raw.subarray(0, 16).toString("hex"));
  for (const [label, data] of [
    ["raw", raw],
    ["inflate", tryInf(raw)],
    ["inflate2", tryInf(raw.subarray(2))],
  ] as const) {
    if (!data) continue;
    const sample = data.subarray(0, 200);
    const asUtf16 = decodeUtf16(data.subarray(0, 800));
    console.log(" ", label, data.length, "utf16", JSON.stringify(asUtf16.slice(0, 120)));
    void sample;
  }
}
}

function tryInf(b: Buffer) {
  try {
    return inflateSync(b);
  } catch {
    return null;
  }
}

function decodeUtf16(data: Buffer) {
  const chars: string[] = [];
  for (let i = 0; i + 1 < data.length; i += 2) {
    const c = data.readUInt16LE(i);
    if (c >= 32 && c < 0xfffe) chars.push(String.fromCharCode(c));
  }
  return chars.join("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

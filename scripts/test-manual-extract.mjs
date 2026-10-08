import { readFile, writeFile, mkdir } from "fs/promises";
import { createRequire } from "module";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const tsx = join(dirname(fileURLToPath(import.meta.url)), "..");

async function loadTs() {
  const { register } = require("node:module");
  try {
    const { pathToFileURL } = await import("url");
    register("tsx/esm", pathToFileURL("./"));
  } catch {
    // fall through to compiled-less dynamic import via next is not available; use pdf extract copy
  }
}

void loadTs;

const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("usage: node scripts/test-manual-extract.mjs <pdf> [hwp]");
  process.exit(1);
}

const data = new Uint8Array(await readFile(pdfPath));
const pdf = await getDocument({ data, disableWorker: true }).promise;
const report = { file: pdfPath, pages: pdf.numPages, imageHeavy: [], empty: [], page58: null, page59: null };

for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i);
  const content = await page.getTextContent();
  const text = content.items.map((it) => it.str || "").join("").replace(/\s/g, "");
  const ops = await page.getOperatorList();
  let imageCount = 0;
  for (const fn of ops.fnArray) if (fn === 85 || fn === 86 || fn === 87) imageCount += 1;
  const rec = { page: i, chars: text.length, imageCount, printed: (content.items.map((it) => it.str || "").join(" ").match(/-\s*(\d+)\s*-/) || [])[1] || null };
  if (text.length < 40) report.empty.push(rec);
  if (imageCount > 0 && text.length < 120) report.imageHeavy.push(rec);
  if (i === 58) report.page58 = rec;
  if (i === 59) report.page59 = rec;
}

await mkdir("data/manual-store", { recursive: true });
await writeFile("data/manual-store/pdf-scan-report.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

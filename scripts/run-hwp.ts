import { readFile } from "fs/promises";
import { extractManualFile } from "../src/lib/extract/index.ts";

async function main() {
  const p = process.argv[2];
  if (!p) throw new Error("path required");
  const buf = await readFile(p);
  const r = await extractManualFile(buf, p.split(/[/\\]/).pop() || "file.hwp");
  console.log(JSON.stringify({
    file: p,
    format: r.format,
    status: r.status,
    error: r.error,
    warnings: r.warnings,
    pageCount: r.pageCount,
    charCount: r.pages.reduce((n, x) => n + x.charCount, 0),
    textStart: r.pages[0]?.text.slice(0, 500) || "",
    images: r.pages[0]?.images.length || 0,
    tables: r.tables.length,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

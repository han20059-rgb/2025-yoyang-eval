import { readFile } from "fs/promises";
import { extractHangul } from "../src/lib/extract/hwp.ts";

async function main() {
  const buf = await readFile("data/manual-store/official/2025-eval-manual.hwp");
  const hwp = await extractHangul(buf, "2025-eval-manual.hwp");
  const sizes = hwp.tables.map((t) => t.cells.length).sort((a, b) => b - a);
  const fail: string[] = [];
  if (hwp.tables.length < 10) fail.push(`표 부족 ${hwp.tables.length}`);
  if ((sizes[0] || 0) > 400) fail.push(`최대 셀 ${sizes[0]}`);
  if (!hwp.tables.some((t) => t.cells.some((c) => /[①②③]/.test(c.text)))) fail.push("번호없음");
  const rowcol = hwp.tables.filter((t) => t.cells.some((c) => c.r > 0 || c.c > 0)).length;
  if (rowcol < 10) fail.push("행열 주소 부족");
  const report = {
    ok: fail.length === 0,
    fail,
    status: hwp.status,
    tables: hwp.tables.length,
    topSizes: sizes.slice(0, 8),
    tagsKeep: "CTRL=71 LIST=72 TABLE=77",
  };
  console.log(JSON.stringify(report, null, 2));
  if (fail.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

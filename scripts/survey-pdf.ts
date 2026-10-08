import { readFile, writeFile, mkdir } from "fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

async function survey(path: string, label: string) {
  const data = new Uint8Array(await readFile(path));
  const pdf = await getDocument({ data, disableWorker: true }).promise;
  const pages = [];
  const revHits: { page: number; snippet: string }[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((it) => ("str" in it ? String(it.str) : "")).join("");
    const compact = text.replace(/\s/g, "");
    const ops = await page.getOperatorList();
    let imageCount = 0;
    for (const fn of ops.fnArray) if (fn === 85 || fn === 86 || fn === 87) imageCount += 1;
    const printed = (text.match(/-\s*(\d+)\s*-/) || [])[1] || null;
    pages.push({ page: i, printed, chars: compact.length, imageCount, start: compact.slice(0, 80) });
    if (/개정|수정본|정오|일부개정|추록/.test(text)) {
      revHits.push({ page: i, snippet: text.replace(/\s+/g, " ").slice(0, 160) });
    }
  }
  return {
    label,
    path,
    bytes: data.byteLength,
    pages: pdf.numPages,
    imagePages: pages.filter((p) => p.imageCount > 0),
    sparse: pages.filter((p) => p.chars < 80),
    revHits,
    cover: pages.slice(0, 3),
  };
}

async function main() {
  await mkdir("data/manual-store/test-runs", { recursive: true });
  const a = await survey("C:/cu/pg/manual.pdf", "workspace-manual.pdf");
  const b = await survey("data/manual-store/official/2025-eval-manual.pdf", "official-attached.pdf");
  const out = { a, b, sameFile: false };
  await writeFile("data/manual-store/test-runs/pdf-survey.json", JSON.stringify(out, null, 2), "utf8");
  console.log(JSON.stringify({
    workspace: { pages: a.pages, bytes: a.bytes, images: a.imagePages.length, sparse: a.sparse.length, rev: a.revHits.length, cover: a.cover },
    official: { pages: b.pages, bytes: b.bytes, images: b.imagePages.length, sparse: b.sparse.length, rev: b.revHits.length, cover: b.cover, imagePageNos: b.imagePages.map((p) => p.page) },
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

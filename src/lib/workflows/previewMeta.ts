import { readFile } from "fs/promises";
import { join } from "path";

export async function previewMeta() {
  try {
    const raw = await readFile(join(process.cwd(), "data/manual-store/preview.json"), "utf8");
    const p = JSON.parse(raw) as { editionLabel?: string; pageCount?: number };
    return { label: p.editionLabel || "local-preview", pages: p.pageCount || 0 };
  } catch {
    return { label: "unknown", pages: 0 };
  }
}

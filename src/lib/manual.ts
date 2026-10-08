import type { Manual } from "@/lib/types";

export const MANUAL_URL =
  "https://raw.githubusercontent.com/han20059-rgb/2025-yoyang-eval/main/src/data/manual.json";

export async function loadManual(): Promise<Manual> {
  let data: Manual;
  try {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const raw = await readFile(join(process.cwd(), "src/data/manual.json"), "utf8");
    data = JSON.parse(raw) as Manual;
  } catch {
    const res = await fetch(MANUAL_URL, { next: { revalidate: 3600 } });
    if (!res.ok) {
      throw new Error("평가 매뉴얼 데이터를 불러오지 못했습니다.");
    }
    data = (await res.json()) as Manual;
  }
  try {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const previewRaw = await readFile(join(process.cwd(), "data/manual-store/preview.json"), "utf8");
    const preview = JSON.parse(previewRaw) as {
      localPreview?: boolean;
      exposeToStaff?: boolean;
      editionLabel?: string;
      indicators?: Manual["indicators"][number]["fullSource"][];
    };
    if (preview.exposeToStaff) {
      /* production expose is a separate admin action; ignore here unless explicitly true later */
    }
    if (preview.localPreview && Array.isArray(preview.indicators)) {
      data.indicators = data.indicators.map((ind) => {
        const full = preview.indicators?.find((f) => f && f.id === ind.id) || null;
        return {
          ...ind,
          name: full?.name && full.name.length >= 2 ? full.name : ind.name,
          fullSource: full,
          localPreview: true,
          printedPages: full?.printedPages?.length ? full.printedPages : ind.pages,
        };
      });
    }
  } catch {
    /* no local preview overlay */
  }
  return data;
}

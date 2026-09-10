import type { Manual } from "@/lib/types";

export const MANUAL_URL =
  "https://raw.githubusercontent.com/han20059-rgb/2025-yoyang-eval/main/src/data/manual.json";

export async function loadManual(): Promise<Manual> {
  try {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const raw = await readFile(join(process.cwd(), "src/data/manual.json"), "utf8");
    return JSON.parse(raw) as Manual;
  } catch {
    const res = await fetch(MANUAL_URL, { next: { revalidate: 3600 } });
    if (!res.ok) {
      throw new Error("평가 매뉴얼 데이터를 불러오지 못했습니다.");
    }
    return res.json() as Promise<Manual>;
  }
}

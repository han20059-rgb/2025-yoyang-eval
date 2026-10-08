import { createWorker } from "tesseract.js";

let workerPromise: Promise<Awaited<ReturnType<typeof createWorker>>> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker("kor+eng", 1, {
      errorHandler: () => undefined,
    });
  }
  return workerPromise;
}

export async function ocrImageBuffer(buf: Buffer, hint: string): Promise<{ text: string; ok: boolean; error?: string }> {
  if (!buf.length) {
    return { text: "", ok: false, error: `${hint}: 빈 이미지` };
  }
  try {
    const worker = await getWorker();
    const result = await worker.recognize(buf);
    const text = (result.data.text || "").trim();
    if (!text) {
      return { text: "", ok: false, error: `${hint}: OCR 결과가 비었습니다. 확인 필요` };
    }
    return { text, ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { text: "", ok: false, error: `${hint}: OCR 실패 (${msg})` };
  }
}

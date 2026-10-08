import { extractHangul } from "@/lib/extract/hwp";
import { extractPdf } from "@/lib/extract/pdf";
import type { FileExtractResult } from "@/lib/extract/types";

export function detectFormat(fileName: string, buf: Buffer): "pdf" | "hwp" | "hwpx" | "unsupported" {
  const lower = fileName.toLowerCase();
  if (buf.subarray(0, 5).toString("utf8") === "%PDF-") return "pdf";
  if (buf.subarray(0, 2).toString("utf8") === "PK" && (lower.endsWith(".hwpx") || lower.endsWith(".zip"))) return "hwpx";
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".hwpx")) return "hwpx";
  if (lower.endsWith(".hwp")) return "hwp";
  if (buf.includes(Buffer.from("HWP Document File"))) return "hwp";
  return "unsupported";
}

export async function extractManualFile(buf: Buffer, fileName: string): Promise<FileExtractResult> {
  const format = detectFormat(fileName, buf);
  if (format === "unsupported") {
    return {
      format: "pdf",
      fileName,
      status: "failed",
      error: `지원하지 않는 파일입니다: ${fileName}`,
      warnings: [`지원하지 않는 파일입니다: ${fileName}`],
      pageCount: 0,
      pages: [],
      blocks: [],
      tables: [],
      classified: { criteria: "", scores: "", method: "", period: "", frequency: "", deadline: "", exceptions: "", law: "" },
      classifiedIsInterpretation: true,
      comparedWithOtherFormat: false,
    };
  }
  if (format === "pdf") return extractPdf(buf, fileName);
  return extractHangul(buf, fileName);
}

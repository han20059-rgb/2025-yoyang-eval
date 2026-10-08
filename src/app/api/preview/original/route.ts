import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/staffSession";
import { listEditions, readStoredFile } from "@/lib/manualStore";

export const runtime = "nodejs";

async function resolveEvalManualPdf(): Promise<{ name: string; buf: Buffer } | null> {
  const store = join(process.cwd(), "data", "manual-store");
  try {
    const preview = JSON.parse(await readFile(join(store, "preview.json"), "utf8")) as { pdfFile?: string };
    if (preview.pdfFile) {
      const buf = await readFile(join(store, preview.pdfFile));
      if (buf.subarray(0, 5).toString("utf8") === "%PDF-") {
        return { name: preview.pdfFile.split(/[/\\]/).pop() || "eval-manual.pdf", buf };
      }
    }
  } catch {
    /* fall through to registered editions */
  }
  const editions = await listEditions();
  const files = editions.map((e) => e.files.pdf).filter(Boolean) as { name: string; stored: string; size: number }[];
  files.sort((a, b) => b.size - a.size);
  for (const file of files) {
    try {
      const buf = await readStoredFile(file.stored);
      if (buf.subarray(0, 5).toString("utf8") === "%PDF-") return { name: file.name, buf };
    } catch {
      /* skip */
    }
  }
  return null;
}

function pdfHeaders(length: number, fileName: string) {
  return {
    "Content-Type": "application/pdf",
    "Content-Length": String(length),
    "Accept-Ranges": "bytes",
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(fileName || "eval-manual.pdf")}`,
    "Cache-Control": "private, max-age=60",
    "X-Content-Type-Options": "nosniff",
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const raw = url.searchParams.get("raw") === "1";
  const pageNum = Number(url.searchParams.get("page") || "");
  if (kind !== "pdf" && kind !== "hwp") {
    return NextResponse.json({ error: "kind=pdf 또는 hwp" }, { status: 400 });
  }
  if (kind === "pdf" && !raw) {
    const page = Number.isFinite(pageNum) && pageNum > 0 ? Math.floor(pageNum) : 0;
    const hash = page ? `#page=${page}` : "";
    const src = `/api/preview/original?kind=pdf&raw=1${hash}`;
    const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>원본 PDF${page ? ` ${page}쪽` : ""}</title><style>html,body,embed{margin:0;width:100%;height:100%;border:0;background:#525252}</style></head><body><embed src="${src}" type="application/pdf" /></body></html>`;
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, max-age=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  if (kind === "hwp") {
    if (req.headers.get("x-eval-demo") === "1") {
      return NextResponse.json({ error: "시연 모드에서는 원본 파일을 저장·내려받지 않습니다." }, { status: 403 });
    }
    const staff = await requireStaff(req);
    if (!staff.ok) return staff.res;
  }
  if (kind === "pdf") {
    const pdf = await resolveEvalManualPdf();
    if (!pdf) return NextResponse.json({ error: "원본 파일이 없습니다. 확인 필요" }, { status: 404 });
    const buf = pdf.buf;
    const range = req.headers.get("range");
    const total = buf.length;
    if (range) {
      const m = range.match(/bytes=(\d*)-(\d*)/);
      if (m) {
        const start = m[1] ? Number(m[1]) : 0;
        const end = m[2] ? Number(m[2]) : total - 1;
        if (Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end < total && start <= end) {
          const slice = buf.subarray(start, end + 1);
          return new NextResponse(new Uint8Array(slice), {
            status: 206,
            headers: {
              ...pdfHeaders(slice.length, pdf.name),
              "Content-Range": `bytes ${start}-${end}/${total}`,
              "Content-Length": String(slice.length),
            },
          });
        }
      }
    }
    return new NextResponse(new Uint8Array(buf), { headers: pdfHeaders(total, pdf.name) });
  }
  const editions = await listEditions();
  const hit = editions.find((e) => e.files.hwp);
  const file = hit?.files.hwp;
  if (!file) return NextResponse.json({ error: "원본 파일이 없습니다. 확인 필요" }, { status: 404 });
  try {
    const buf = await readStoredFile(file.stored);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      },
    });
  } catch {
    return NextResponse.json({ error: "원본 파일을 읽지 못했습니다. 확인 필요" }, { status: 404 });
  }
}

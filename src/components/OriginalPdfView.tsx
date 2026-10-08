"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function OriginalPdfView() {
  const sp = useSearchParams();
  const want = Math.max(1, Math.floor(Number(sp.get("page") || "1") || 1));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [info, setInfo] = useState("원본 PDF를 불러오는 중");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/preview/original?kind=pdf&raw=1");
      if (!res.ok) {
        setInfo("원본 PDF를 열지 못했습니다. 확인 필요");
        return;
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const pdf = await pdfjs.getDocument({ data: buf }).promise;
      const pageNum = Math.min(want, pdf.numPages);
      const page = await pdf.getPage(pageNum);
      if (cancelled) return;
      const viewport = page.getViewport({ scale: 1.25 });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      if (!cancelled) setInfo(`파일 ${pageNum}쪽 / 전체 ${pdf.numPages}쪽`);
    })().catch((err: unknown) =>
      setInfo(`원본 PDF를 그리지 못했습니다. ${err instanceof Error ? err.message : String(err)}`)
    );
    return () => {
      cancelled = true;
    };
  }, [want]);
  return (
    <main className="min-h-screen bg-stone-800 p-3 text-white">
      <p className="mb-2 text-sm">{info}</p>
      <canvas ref={canvasRef} className="mx-auto max-w-full bg-white" />
    </main>
  );
}

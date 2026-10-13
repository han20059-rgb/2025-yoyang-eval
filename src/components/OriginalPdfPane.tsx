"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useEvalSession } from "@/components/EvalSession";

type RenderTask = { promise: Promise<void>; cancel: () => void };
type Viewport = { width: number; height: number; scale: number };
type TextContent = { items: { str?: string }[] };
type PdfPage = {
  getViewport: (opts: { scale: number }) => Viewport;
  render: (opts: {
    canvas?: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: Viewport;
    transform?: number[];
  }) => RenderTask;
  getTextContent: () => Promise<TextContent>;
};
type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
};
type TextLayerHandle = { render: () => Promise<unknown>; cancel: () => void };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function PdfPageCanvas({
  pdf,
  pageNum,
  userScale,
  paneWidth,
  scrollRoot,
  priority,
  onVisible,
  onTextStats,
}: {
  pdf: PdfDoc;
  pageNum: number;
  userScale: number;
  paneWidth: number;
  scrollRoot: RefObject<HTMLDivElement | null>;
  priority: boolean;
  onVisible: (n: number) => void;
  onTextStats: (n: number, chars: number) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(priority);
  const [cssH, setCssH] = useState(Math.round(paneWidth * 1.35) || 480);
  const taskRef = useRef<RenderTask | null>(null);
  const layerRef = useRef<TextLayerHandle | null>(null);
  const genRef = useRef(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const loadIo = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        setReady(hit);
      },
      { root: scrollRoot.current, rootMargin: "400px 0px", threshold: 0.01 }
    );
    const pageIo = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.25)) onVisible(pageNum);
      },
      { root: scrollRoot.current, rootMargin: "0px", threshold: [0.25, 0.6] }
    );
    loadIo.observe(el);
    pageIo.observe(el);
    return () => {
      loadIo.disconnect();
      pageIo.disconnect();
    };
  }, [onVisible, pageNum, scrollRoot]);

  useEffect(() => {
    if (!ready || paneWidth < 40) return;
    const gen = ++genRef.current;
    let cancelled = false;
    taskRef.current?.cancel();
    layerRef.current?.cancel();
    taskRef.current = null;
    layerRef.current = null;

    (async () => {
      const page = await pdf.getPage(pageNum);
      if (cancelled || gen !== genRef.current) return;
      const base = page.getViewport({ scale: 1 });
      const cssScale = (paneWidth / base.width) * userScale;
      const viewport = page.getViewport({ scale: cssScale });
      const canvas = canvasRef.current;
      const textEl = textRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const outputScale = Math.min(Math.max(dpr, 1), 3);
      const cssW = Math.floor(viewport.width);
      const nextH = Math.floor(viewport.height);
      canvas.width = Math.floor(cssW * outputScale);
      canvas.height = Math.floor(nextH * outputScale);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${nextH}px`;
      setCssH(nextH);
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
      const task = page.render({ canvasContext: ctx, canvas, viewport, transform });
      taskRef.current = task;
      try {
        await task.promise;
      } catch (err) {
        const name = err instanceof Error ? err.name : "";
        if (name === "RenderingCancelledException" || cancelled || gen !== genRef.current) return;
        throw err;
      }
      if (cancelled || gen !== genRef.current) return;

      const content = await page.getTextContent();
      if (cancelled || gen !== genRef.current) return;
      const chars = content.items.reduce((n, it) => n + (it.str?.trim().length || 0), 0);
      onTextStats(pageNum, chars);
      if (!textEl) return;
      textEl.replaceChildren();
      textEl.style.width = `${cssW}px`;
      textEl.style.height = `${nextH}px`;
      textEl.style.setProperty("--scale-factor", String(viewport.scale));
      textEl.style.setProperty("--total-scale-factor", String(viewport.scale));
      if (!chars) return;
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const layer = new pdfjs.TextLayer({
        textContentSource: content,
        container: textEl,
        viewport,
      } as never) as TextLayerHandle;
      layerRef.current = layer;
      await layer.render();
    })().catch(() => {
      /* keep placeholder */
    });

    return () => {
      cancelled = true;
      taskRef.current?.cancel();
      layerRef.current?.cancel();
      taskRef.current = null;
      layerRef.current = null;
    };
  }, [pdf, pageNum, userScale, paneWidth, ready, onTextStats]);

  useEffect(() => {
    if (ready) return;
    taskRef.current?.cancel();
    layerRef.current?.cancel();
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    textRef.current?.replaceChildren();
  }, [ready]);

  const cssW = Math.max(1, Math.floor(paneWidth * userScale));
  return (
    <div
      ref={wrapRef}
      className="relative mb-2 bg-white"
      data-pdf-page={pageNum}
      style={{ width: cssW, height: cssH }}
    >
      <canvas ref={canvasRef} className="block bg-white" />
      <div ref={textRef} className="textLayer pointer-events-auto absolute inset-0 overflow-hidden" />
    </div>
  );
}

export function OriginalPdfPane({
  indicatorId,
  indicatorName,
  from: fromProp,
  to: toProp,
  scrollRef,
}: {
  indicatorId: number;
  indicatorName?: string;
  from: number;
  to: number;
  scrollRef?: RefObject<HTMLDivElement | null>;
}) {
  const { identity } = useEvalSession();
  const innerScroll = useRef<HTMLDivElement>(null);
  const scroller = scrollRef || innerScroll;
  const [pdf, setPdf] = useState<PdfDoc | null>(null);
  const [adminMeta, setAdminMeta] = useState("");
  const [scale, setScale] = useState(1);
  const [current, setCurrent] = useState(fromProp);
  const [from, setFrom] = useState(fromProp);
  const [to, setTo] = useState(toProp);
  const [tick, setTick] = useState(0);
  const [err, setErr] = useState("");
  const [paneWidth, setPaneWidth] = useState(0);
  const [scanPages, setScanPages] = useState<number[]>([]);
  const widthTimer = useRef<number>(0);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const apply = () => {
      const w = Math.floor(el.clientWidth - 16);
      if (w < 80) return;
      window.clearTimeout(widthTimer.current);
      widthTimer.current = window.setTimeout(() => setPaneWidth((prev) => (Math.abs(prev - w) < 2 ? prev : w)), 80);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      window.clearTimeout(widthTimer.current);
    };
  }, [scroller, pdf]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const metaRes = await fetch("/api/preview/original?kind=meta");
      if (metaRes.ok) {
        const m = (await metaRes.json()) as { fileName?: string; editionLabel?: string; sha12?: string; pageCount?: number };
        if (!cancelled) {
          setAdminMeta(
            [m.editionLabel, m.fileName, m.sha12 ? `sha ${m.sha12}` : "", m.pageCount ? `전체 ${m.pageCount}쪽` : ""].filter(Boolean).join(" · ")
          );
        }
      }
      const res = await fetch("/api/preview/original?kind=pdf&raw=1");
      if (!res.ok) {
        setErr("원본 PDF를 열지 못했습니다. 확인 필요");
        return;
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const doc = (await pdfjs.getDocument({ data: buf }).promise) as unknown as PdfDoc;
      if (cancelled) return;
      const start = clamp(fromProp || 1, 1, doc.numPages);
      const end = clamp(toProp || start, start, doc.numPages);
      setFrom(start);
      setTo(end);
      setCurrent(start);
      setScanPages([]);
      setPdf(doc);
    })().catch((e: unknown) => setErr(`원본 PDF를 그리지 못했습니다. ${e instanceof Error ? e.message : String(e)}`));
    return () => {
      cancelled = true;
    };
  }, [fromProp, toProp, indicatorId, tick]);

  const onVisible = useCallback((n: number) => setCurrent(n), []);
  const onTextStats = useCallback((n: number, chars: number) => {
    if (chars >= 40) return;
    setScanPages((prev) => (prev.includes(n) ? prev : [...prev, n].sort((a, b) => a - b)));
  }, []);
  const pages = pdf ? Array.from({ length: to - from + 1 }, (_, i) => from + i) : [];

  function go(delta: number) {
    const next = clamp(current + delta, from, to);
    setCurrent(next);
    scroller.current?.querySelector(`[data-pdf-page="${next}"]`)?.scrollIntoView({ block: "start" });
  }

  const title = indicatorId ? `지표 ${indicatorId}${indicatorName ? ` · ${indicatorName}` : ""}` : "원본 PDF";

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden bg-stone-800 text-white">
      <div className="shrink-0 border-b border-stone-700 bg-stone-900 px-2 py-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] leading-5">
          <p className="font-medium">{err || title}</p>
          {pdf ? (
            <p className="text-stone-300">
              원본 {from}–{to}쪽 · {current}쪽 · {Math.round(scale * 100)}%
            </p>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <button type="button" className="min-h-11 rounded-lg border border-stone-500 px-2.5" onClick={() => go(-1)} disabled={!pdf || current <= from}>
            이전 쪽
          </button>
          <button type="button" className="min-h-11 rounded-lg border border-stone-500 px-2.5" onClick={() => go(1)} disabled={!pdf || current >= to}>
            다음 쪽
          </button>
          <button type="button" className="min-h-11 rounded-lg border border-stone-500 px-2.5" onClick={() => setScale((s) => clamp(s - 0.25, 0.5, 2.5))}>
            축소
          </button>
          <button type="button" className="min-h-11 rounded-lg border border-stone-500 px-2.5" onClick={() => setScale((s) => clamp(s + 0.25, 0.5, 2.5))}>
            확대
          </button>
          {err ? (
            <button type="button" className="min-h-11 rounded-lg border border-amber-400 px-2.5 text-amber-100" onClick={() => setTick((n) => n + 1)}>
              다시 불러오기
            </button>
          ) : null}
        </div>
        {identity?.isAdmin && adminMeta ? (
          <details className="mt-1 text-[12px] text-stone-400">
            <summary className="min-h-11 cursor-pointer leading-[2.75rem]">원본 파일 정보 (관리자)</summary>
            <p className="pb-1">{adminMeta}</p>
          </details>
        ) : null}
        {scanPages.length ? (
          <p className="pb-0.5 text-[12px] text-stone-400">
            {scanPages.join(", ")}쪽은 글자 레이어가 거의 없습니다. 그림·스캔이면 확대해도 원본 해상도가 한계입니다.
          </p>
        ) : null}
      </div>
      <div ref={scroller} className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain">
        <div className="p-2" style={{ width: paneWidth && scale > 1 ? Math.floor(paneWidth * scale) + 16 : undefined }}>
          {pdf && paneWidth
            ? pages.map((n, i) => (
                <PdfPageCanvas
                  key={n}
                  pdf={pdf}
                  pageNum={n}
                  userScale={scale}
                  paneWidth={paneWidth}
                  scrollRoot={scroller}
                  priority={i < 1}
                  onVisible={onVisible}
                  onTextStats={onTextStats}
                />
              ))
            : (
              <p className="p-3 text-sm text-stone-300">{err || "원본을 불러오는 중"}</p>
            )}
        </div>
      </div>
    </div>
  );
}

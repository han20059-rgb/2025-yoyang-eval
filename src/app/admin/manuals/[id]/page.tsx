"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ARCHIVE_STORAGE, RECHECK_STORAGE } from "@/lib/checks";
import { adminFetch } from "@/lib/adminClient";

type Edition = {
  id: string;
  evalYear: number | null;
  docKind: string;
  publishedOn: string | null;
  appliedOn: string | null;
  source: string;
  editionKind: string;
  parentId: string | null;
  evalCycleNote: string;
  status: string;
  files: { pdf?: { name: string }; hwp?: { name: string } };
  extracts: {
    pdf?: ExtractSlim;
    hwp?: ExtractSlim;
  };
  compare?: { compared: boolean; note: string; diffs: { page: number | null; note: string; kind: string }[]; cannotConfirmNoOmission: boolean };
  revisionChanges?: { type: string; note: string; left?: { indicatorHint: string; mark: string; text: string }; right?: { indicatorHint: string; mark: string; text: string } }[];
  checkPreview?: { keep: string[]; recheck: string[]; archive: string[] };
};

type ExtractSlim = {
  format: string;
  fileName: string;
  status: string;
  error?: string;
  warnings: string[];
  pageCount: number;
  classified: Record<string, string>;
  classifiedIsInterpretation: boolean;
  comparedWithOtherFormat: boolean;
  pages?: { page: number; printedPage: number | null; charCount: number; imageCount: number; ocrUsed: boolean; needsReview: boolean; reviewReasons: string[]; text?: string; textStart?: string }[];
};

export default function ManualReviewPage() {
  const params = useParams<{ id: string }>();
  const [edition, setEdition] = useState<Edition | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const res = await adminFetch(`/api/manuals/${params.id}`);
    const data = await res.json();
    setEdition(data.edition);
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function extract() {
    setBusy("extract");
    setMsg("파일을 읽는 중입니다. 이미지 페이지는 OCR 때문에 시간이 걸릴 수 있습니다.");
    const res = await adminFetch(`/api/manuals/${params.id}/extract`, { method: "POST" });
    const data = await res.json();
    setBusy("");
    if (!res.ok) {
      setMsg(data.error || "읽기 실패");
      return;
    }
    setEdition(data.edition);
    setMsg(data.compare?.note || "읽기 완료. 분류 칸은 앱의 해석입니다.");
    await load();
  }

  async function addFiles(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy("files");
    const res = await adminFetch(`/api/manuals/${params.id}/files`, { method: "POST", body: new FormData(e.currentTarget) });
    const data = await res.json();
    setBusy("");
    setMsg(data.note || data.error || "");
    await load();
  }

  async function revision() {
    setBusy("rev");
    let keys: string[] = [];
    try {
      keys = Object.keys(JSON.parse(localStorage.getItem("yoyang-eval-checks-v1") || "{}"));
    } catch {
      keys = [];
    }
    const res = await adminFetch(`/api/manuals/${params.id}/revision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ localCheckKeys: keys }),
    });
    const data = await res.json();
    setBusy("");
    if (!res.ok) {
      setMsg(data.error || "비교 실패");
      return;
    }
    setMsg(`${data.comparisonKind === "same-year-revision" ? "같은 연도 개정본 비교" : "평가연도 간 비교"}. ${data.checkNote}`);
    await load();
  }

  async function applyRecheck() {
    setBusy("apply");
    let keys: string[] = [];
    let checks: Record<string, boolean> = {};
    try {
      checks = JSON.parse(localStorage.getItem("yoyang-eval-checks-v1") || "{}") as Record<string, boolean>;
      keys = Object.keys(checks);
    } catch {
      keys = [];
    }
    const res = await adminFetch(`/api/manuals/${params.id}/revision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ localCheckKeys: keys, apply: true, checks }),
    });
    const data = await res.json();
    setBusy("");
    if (!res.ok) {
      setMsg(data.error || "적용 실패");
      return;
    }
    try {
      const prevArchive = localStorage.getItem(ARCHIVE_STORAGE);
      const stack = prevArchive ? (JSON.parse(prevArchive) as unknown[]) : [];
      stack.push({ at: new Date().toISOString(), checks, recheck: data.checkPreview?.recheck || [] });
      localStorage.setItem(ARCHIVE_STORAGE, JSON.stringify(stack));
      localStorage.setItem(RECHECK_STORAGE, JSON.stringify(data.checkPreview?.recheck || []));
      window.dispatchEvent(new Event("yoyang-progress"));
    } catch {
      /* ignore */
    }
    setMsg(data.note || "재확인 표시만 적용했습니다. 확정 매뉴얼은 바꾸지 않았습니다.");
    await load();
  }

  async function rollbackChecks() {
    setBusy("rollback");
    try {
      const stack = JSON.parse(localStorage.getItem(ARCHIVE_STORAGE) || "[]") as { checks?: Record<string, boolean> }[];
      const last = stack.pop();
      if (!last?.checks) {
        setBusy("");
        setMsg("되돌릴 체크 스냅샷이 없습니다.");
        return;
      }
      localStorage.setItem("yoyang-eval-checks-v1", JSON.stringify(last.checks));
      localStorage.setItem(ARCHIVE_STORAGE, JSON.stringify(stack));
      localStorage.setItem(RECHECK_STORAGE, "[]");
      window.dispatchEvent(new Event("yoyang-progress"));
    } catch {
      setBusy("");
      setMsg("되돌리기에 실패했습니다.");
      return;
    }
    await adminFetch(`/api/manuals/${params.id}/revision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rollback: true }),
    });
    setBusy("");
    setMsg("이전 체크 스냅샷으로 되돌렸습니다. 확정 매뉴얼 파일은 그대로입니다.");
  }

  async function approve() {
    const res = await adminFetch(`/api/manuals/${params.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve" }) });
    const data = await res.json();
    setMsg(data.note || data.error);
    await load();
  }

  if (!edition) return <p className="text-stone-500">불러오는 중…</p>;

  return (
    <div className="space-y-6">
      <p>
        <Link href="/admin/manuals" className="text-sm text-(--teal) underline">
          목록
        </Link>
      </p>
      <section className="rounded-2xl border border-(--line) bg-(--card) p-5">
        <h2 className="text-lg font-semibold">원본과 추출</h2>
        <p className="mt-1 text-sm text-stone-600">
          {edition.evalYear ?? "연도 미입력"} · {edition.docKind} · 배포일 {edition.publishedOn || "미입력"} · 적용일 {edition.appliedOn || "미입력"} · 출처 {edition.source || "미입력"}
        </p>
        <p className="mt-1 text-sm text-stone-600">평가 주기: {edition.evalCycleNote || "미입력"} (각 기준 적용기간과 별도)</p>
        <p className="mt-1 text-sm">상태 {edition.status} · 직원 노출 없음</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button disabled={!!busy} onClick={() => void extract()} className="min-h-11 rounded-full bg-(--teal) px-4 py-2 text-sm text-white">
            {busy === "extract" ? "읽는 중…" : "파일 읽기"}
          </button>
          <button disabled={!!busy} onClick={() => void revision()} className="min-h-11 rounded-full border border-stone-300 px-4 py-2 text-sm">
            개정·연도 비교 미리보기
          </button>
          <button disabled={!!busy} onClick={() => void applyRecheck()} className="min-h-11 rounded-full border border-amber-400 px-4 py-2 text-sm">
            재확인 표시만 적용 (체크 유지)
          </button>
          <button disabled={!!busy} onClick={() => void rollbackChecks()} className="min-h-11 rounded-full border border-stone-300 px-4 py-2 text-sm">
            체크 스냅샷 되돌리기
          </button>
          <button onClick={() => void approve()} className="min-h-11 rounded-full border border-stone-300 px-4 py-2 text-sm">
            관리자 검토 기록만
          </button>
          {edition.files.pdf ? (
            <a className="min-h-11 rounded-full border border-stone-300 px-4 py-2 text-sm" href={`/api/manuals/${edition.id}/files/download?kind=pdf`}>
              PDF 원본
            </a>
          ) : null}
          {edition.files.hwp ? (
            <a className="min-h-11 rounded-full border border-stone-300 px-4 py-2 text-sm" href={`/api/manuals/${edition.id}/files/download?kind=hwp`}>
              한글 원본
            </a>
          ) : null}
        </div>
        <form className="mt-4 flex flex-wrap gap-3 text-sm" onSubmit={addFiles}>
          <label>
            PDF 추가
            <input name="pdf" type="file" accept=".pdf" className="block" />
          </label>
          <label>
            한글 추가
            <input name="hwp" type="file" accept=".hwp,.hwpx" className="block" />
          </label>
          <button disabled={!!busy} className="self-end rounded-full border border-stone-300 px-3 py-1.5">
            같은 버전에 파일 추가
          </button>
        </form>
        {msg ? <p className="mt-3 text-sm text-amber-800">{msg}</p> : null}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <ExtractCard title="PDF 원문" file={edition.files.pdf?.name} extract={edition.extracts.pdf} />
        <ExtractCard title="아래한글 원문" file={edition.files.hwp?.name} extract={edition.extracts.hwp} />
      </div>

      <section className="rounded-2xl border border-(--line) bg-(--card) p-5 text-sm">
        <h3 className="font-semibold">형식 대조</h3>
        <p className="mt-2">{edition.compare?.compared ? edition.compare.note : "다른 형식과 대조하지 않음"}</p>
        <p className="mt-1 text-stone-500">두 파일이 맞아 보여도 누락 없음을 자동 확정하지 않습니다.</p>
        <ul className="mt-3 list-disc pl-5">
          {(edition.compare?.diffs || []).map((d, i) => (
            <li key={i}>
              {d.kind} {d.page ? `(PDF ${d.page}쪽)` : ""} {d.note}
            </li>
          ))}
        </ul>
      </section>

      {edition.revisionChanges ? (
        <section className="rounded-2xl border border-(--line) bg-(--card) p-5 text-sm">
          <h3 className="font-semibold">개정 미리보기</h3>
          <p className="mt-1">유지 {edition.checkPreview?.keep.length ?? 0} · 재확인 필요 {edition.checkPreview?.recheck.length ?? 0} · 보관 {edition.checkPreview?.archive.length ?? 0}</p>
          <ul className="mt-3 space-y-2">
            {edition.revisionChanges.slice(0, 40).map((c, i) => (
              <li key={i} className="rounded-xl bg-(--paper) p-3">
                <p className="font-medium">{c.type}</p>
                <p>{c.note}</p>
                <p className="mt-1 text-stone-500">이전 {c.left?.indicatorHint} {c.left?.mark} {c.left?.text?.slice(0, 80)}</p>
                <p className="text-stone-500">다음 {c.right?.indicatorHint} {c.right?.mark} {c.right?.text?.slice(0, 80)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ExtractCard({ title, file, extract }: { title: string; file?: string; extract?: ExtractSlim }) {
  return (
    <article className="rounded-2xl border border-(--line) bg-(--card) p-5 text-sm">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1">{file || "파일 없음"}</p>
      {!extract ? <p className="mt-2 text-stone-500">아직 읽지 않았습니다.</p> : null}
      {extract ? (
        <div className="mt-2 space-y-2">
          <p>
            상태: {extract.status}
            {extract.error ? ` · ${extract.error}` : ""}
          </p>
          <p>페이지 {extract.pageCount}</p>
          <p className="text-amber-800">{(extract.warnings || []).join(" / ")}</p>
          <div className="rounded-xl bg-(--paper) p-3">
            <p className="font-medium">앱의 해석 (원문 아님)</p>
            {Object.entries(extract.classified || {}).map(([k, v]) => (
              <p key={k} className="mt-1">
                <span className="text-stone-500">{k}: </span>
                {(v || "(추출 없음)").slice(0, 180)}
              </p>
            ))}
          </div>
          <ul className="max-h-80 space-y-2 overflow-auto">
            {(extract.pages || []).map((p) => (
              <li key={p.page} className="rounded-xl border border-(--line) p-2">
                <p>
                  파일 {p.page}쪽 · 본문표기 {p.printedPage ?? "없음"} · 글자 {p.charCount} · 이미지 {p.imageCount}
                  {p.ocrUsed ? " · OCR" : ""}
                  {p.needsReview ? " · 확인 필요" : ""}
                </p>
                {p.reviewReasons?.length ? <p className="text-amber-800">{p.reviewReasons.join(" ")}</p> : null}
                <pre className="mt-1 whitespace-pre-wrap text-xs text-stone-700">{(p.text || p.textStart || "").slice(0, 500)}</pre>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

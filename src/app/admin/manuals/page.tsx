"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminClient";

type Row = {
  id: string;
  evalYear: number | null;
  docKind: string;
  publishedOn: string | null;
  appliedOn: string | null;
  editionKind: string;
  status: string;
  files: { pdf?: { name: string }; hwp?: { name: string } };
  extracts: { pdf?: { status: string; pageCount: number }; hwp?: { status: string; pageCount: number } };
  compare?: { note: string; compared: boolean };
};

export default function AdminManualsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await adminFetch("/api/manuals");
    const data = await res.json();
    setRows(data.editions || []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const form = new FormData(e.currentTarget);
    const res = await adminFetch("/api/manuals", { method: "POST", body: form });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error || "등록 실패");
      return;
    }
    setMsg("등록했습니다. 아직 직원 화면에는 나가지 않습니다. 이어서 읽기를 실행하세요.");
    e.currentTarget.reset();
    await refresh();
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-(--line) bg-(--card) p-5">
        <h2 className="text-lg font-semibold">매뉴얼 파일 등록</h2>
        <p className="mt-2 text-sm text-stone-600">
          PDF만, 아래한글만, 또는 둘 다 가능합니다. 날짜는 아는 것만 적으세요. 빈 칸을 오늘 날짜로 채우지 않습니다.
          최초본과 수정본은 따로 등록합니다. 파일명만으로 같은 배포본이라고 보지 않습니다.
        </p>
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={onCreate}>
          <label className="text-sm">
            평가연도
            <input name="evalYear" className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2" placeholder="예: 2025" />
          </label>
          <label className="text-sm">
            문서 종류
            <input name="docKind" className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2" defaultValue="시설급여 평가매뉴얼" />
          </label>
          <label className="text-sm">
            배포일
            <input name="publishedOn" type="date" className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2" />
          </label>
          <label className="text-sm">
            적용일
            <input name="appliedOn" type="date" className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2" />
          </label>
          <label className="text-sm sm:col-span-2">
            출처
            <input name="source" className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2" placeholder="예: 국민건강보험공단" />
          </label>
          <label className="text-sm">
            판 구분
            <select name="editionKind" className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2">
              <option value="original">최초 배포본</option>
              <option value="revision">수정본</option>
            </select>
          </label>
          <label className="text-sm">
            이전 등록본 ID (수정본일 때)
            <input name="parentId" className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2" />
          </label>
          <label className="text-sm sm:col-span-2">
            평가 주기 메모 (기준 적용기간과 별도)
            <input name="evalCycleNote" className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2" placeholder="예: 2025년 정기평가 주기" />
          </label>
          <label className="text-sm">
            PDF
            <input name="pdf" type="file" accept=".pdf,application/pdf" className="mt-1 w-full text-sm" />
          </label>
          <label className="text-sm">
            아래한글 (HWP/HWPX)
            <input name="hwp" type="file" accept=".hwp,.hwpx" className="mt-1 w-full text-sm" />
          </label>
          <div className="sm:col-span-2">
            <button disabled={busy} className="min-h-11 rounded-full bg-(--teal) px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              등록
            </button>
          </div>
        </form>
        {msg ? <p className="mt-3 text-sm text-amber-800">{msg}</p> : null}
      </section>

      <section>
        <h3 className="text-lg font-semibold">등록본</h3>
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded-2xl border border-(--line) bg-(--card) p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {row.evalYear ?? "연도 미입력"} · {row.docKind} · {row.editionKind === "revision" ? "수정본" : "최초본"}
                </p>
                <Link className="text-(--teal) underline" href={`/admin/manuals/${row.id}`}>
                  검토
                </Link>
              </div>
              <p className="mt-1 text-stone-600">
                배포일 {row.publishedOn || "미입력"} · 적용일 {row.appliedOn || "미입력"} · {row.status}
              </p>
              <p className="mt-1 text-stone-600">
                PDF {row.files.pdf?.name || "없음"} · 한글 {row.files.hwp?.name || "없음"}
              </p>
              <p className="mt-1 text-stone-500">
                {row.compare?.compared ? row.compare.note : "다른 형식과 대조하지 않음"}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { adminFetch } from "@/lib/adminClient";
import { useEvalSession } from "@/components/EvalSession";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { mode, identity, refresh } = useEvalSession();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [msg, setMsg] = useState("");

  async function check() {
    const res = await adminFetch("/api/admin/session");
    const data = await res.json();
    setAdmin(Boolean(data.admin));
    setMsg(data.admin ? "" : data.error || "");
    setReady(true);
  }

  useEffect(() => {
    void check();
  }, [mode, identity?.leaveRecordId]);

  if (mode === "demo" && pathname.startsWith("/admin/ai-review")) {
    return (
      <div className="space-y-3">
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-[15px] leading-7 text-amber-900">
          시연 검토 화면입니다. AI 미연결이며 결과는 시연용 예시입니다. 실제 저장·운영 DB를 쓰지 않습니다.
        </p>
        {children}
      </div>
    );
  }

  if (mode === "demo") {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-[16px] leading-7">
        시연 모드에서는 관리 화면에 들어갈 수 없습니다.
      </section>
    );
  }

  if (!ready) return <p className="text-stone-500">관리자 확인 중…</p>;
  if (!admin) {
    return (
      <section className="rounded-2xl border border-(--line) bg-(--card) p-5">
        <h2 className="text-lg font-semibold">관리자 로그인</h2>
        <p className="mt-2 text-[16px] leading-7 text-stone-600">
          상단에서 지원부서와 같은 생년월일 6자리와 본인 비밀번호로 로그인해 주세요. 관리자 여부는 직원 고유 ID로 서버에서 확인합니다. 공용 관리 키는 쓰지 않습니다.
        </p>
        {identity ? (
          <p className="mt-3 text-sm text-amber-800">{msg || "이 직원 계정에는 관리자 권한이 없습니다."}</p>
        ) : (
          <p className="mt-3 text-sm text-stone-500">아직 로그인하지 않았습니다.</p>
        )}
      </section>
    );
  }

  async function onLogout() {
    await adminFetch("/api/admin/session", { method: "DELETE" });
    await refresh();
    setAdmin(false);
  }

  return (
    <div className="space-y-4">
      <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
        관리자 {identity?.name} (직원 ID {identity?.leaveRecordId}). 여기서 읽은 내용은 기존 직원용 매뉴얼·준비 체크를 덮어쓰지 않습니다.
      </p>
      <nav className="flex flex-col gap-1.5">
        <a href="/admin/manuals" className="inline-flex min-h-11 items-center rounded-xl border bg-white px-3">매뉴얼 등록</a>
        <a href="/admin/assignments" className="inline-flex min-h-11 items-center rounded-xl border bg-white px-3">담당 배정 관리</a>
        <a href="/admin/admins" className="inline-flex min-h-11 items-center rounded-xl border bg-white px-3">관리자 관리</a>
        <a href="/admin/ai-review" className="inline-flex min-h-11 items-center rounded-xl border bg-white px-3">AI 연결 검토</a>
        <button type="button" className="min-h-11 rounded-xl border px-3 text-left" onClick={() => void onLogout()}>
          로그아웃
        </button>
      </nav>
      {children}
    </div>
  );
}

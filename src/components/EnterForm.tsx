"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function EnterForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/site-gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    setPassword("");
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setMsg(data.error || "입장에 실패했습니다.");
      return;
    }
    const next = sp.get("next") || "/";
    router.replace(next.startsWith("/") ? next : "/");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-stone-200 bg-white p-6">
      <h2 className="text-xl font-bold">평가 매뉴얼 입장</h2>
      <p className="mt-2 text-[15px] leading-7 text-stone-600">사이트 공통 비밀번호입니다. 관리자 권한은 생기지 않습니다.</p>
      <form className="mt-4 space-y-3" onSubmit={(e) => void onSubmit(e)}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="입장 비밀번호"
          className="min-h-11 w-full rounded-xl border px-3"
          autoComplete="current-password"
          required
        />
        <button disabled={busy} className="min-h-11 w-full rounded-full bg-(--teal) text-white">
          들어가기
        </button>
        {msg ? <p className="text-sm text-amber-800">{msg}</p> : null}
      </form>
    </div>
  );
}

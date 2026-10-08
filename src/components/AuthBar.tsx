"use client";

import { FormEvent, useState } from "react";
import { useEvalSession } from "@/components/EvalSession";
import { roles } from "@/data/duties";

export function AuthBar() {
  const { mode, identity, startDemo, exitDemo, refresh } = useEvalSession();
  const [yymmdd, setYymmdd] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/staff/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yymmdd, password, remember: true }),
    });
    const data = await res.json();
    setBusy(false);
    setPassword("");
    if (!res.ok) {
      setMsg(data.error || "로그인 실패");
      return;
    }
    await refresh();
    window.dispatchEvent(new Event("yoyang-admin"));
  }

  if (mode === "demo") {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-amber-100 px-3 py-2 font-semibold text-amber-900">시연 모드</span>
        <span className="text-stone-600">{identity?.name}</span>
        <button type="button" className="min-h-11 rounded-full border border-stone-300 px-3" onClick={exitDemo}>
          시연 종료
        </button>
      </div>
    );
  }

  if (mode === "staff" && identity) {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-(--teal-soft) px-3 py-2 text-(--teal)">
          {identity.name} · 근무 {identity.jobType || "미연결"} · 평가 {roles.find((r) => r.id === identity.evalRole)?.label || identity.evalRole || "미연결"}
        </span>
        {identity.isAdmin ? <span className="rounded-full bg-amber-100 px-3 py-2 text-amber-900">관리자</span> : null}
        {identity.roleStatus === "review" ? (
          <span className="text-amber-800">평가 직종 확인 필요</span>
        ) : (
          <span className="text-stone-500">평가 직종 연결됨</span>
        )}
        <button
          type="button"
          className="min-h-11 text-stone-500 underline"
          onClick={async () => {
            await fetch("/api/staff/logout", { method: "POST", credentials: "include" });
            await refresh();
          }}
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <form className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center" onSubmit={(e) => void onLogin(e)}>
      <input
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        value={yymmdd}
        onChange={(e) => setYymmdd(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="생년월일 6자리"
        className="min-h-11 w-36 rounded-full border border-stone-300 bg-white px-3"
        autoComplete="username"
      />
      <input
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="비밀번호"
        className="min-h-11 w-28 rounded-full border border-stone-300 bg-white px-3"
        autoComplete="current-password"
      />
      <button disabled={busy} className="min-h-11 rounded-full bg-(--teal) px-4 text-sm font-medium text-white">
        로그인
      </button>
      <button type="button" className="min-h-11 rounded-full border border-stone-300 px-4 text-sm" onClick={startDemo}>
        시연으로 둘러보기
      </button>
      {msg ? <span className="text-sm text-amber-800">{msg}</span> : null}
    </form>
  );
}

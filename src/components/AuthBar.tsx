"use client";

import { FormEvent, useState } from "react";
import { useEvalSession } from "@/components/EvalSession";
import { roles } from "@/data/duties";

export function AuthBar() {
  const { mode, identity, startDemo, exitDemo, setDemoAdmin, refresh } = useEvalSession();
  const [yymmdd, setYymmdd] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const ac = new AbortController();
    const timer = window.setTimeout(() => ac.abort(), 20000);
    try {
      const res = await fetch("/api/staff/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yymmdd, password, remember: true }),
        signal: ac.signal,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMsg(data.error || "로그인 실패");
        return;
      }
      await refresh();
      window.dispatchEvent(new Event("yoyang-admin"));
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === "AbortError";
      setMsg(timedOut ? "시간이 초과되었습니다. 다시 시도해 주세요." : "로그인에 연결하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      window.clearTimeout(timer);
      setBusy(false);
      setPassword("");
    }
  }

  if (mode === "demo") {
    return (
      <div className="flex w-full flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center">
        <span className="font-semibold text-amber-900">시연 중 · 서버에 저장되지 않습니다</span>
        <span className="text-sm text-stone-600">
          {identity?.name}
          {identity?.isAdmin ? " · 관리자 시연" : " · 직원 시연"}
        </span>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="min-h-11 rounded-full border border-stone-300 bg-white px-3" onClick={() => setDemoAdmin(!identity?.isAdmin)}>
            {identity?.isAdmin ? "직원으로 보기" : "관리자로 보기"}
          </button>
          <button type="button" className="min-h-11 rounded-full border border-stone-300 bg-white px-3" onClick={exitDemo}>
            시연 종료
          </button>
        </div>
      </div>
    );
  }

  if (mode === "staff" && identity) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-2 rounded-2xl border border-stone-200 bg-white px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center">
        <span className="rounded-full bg-(--teal-soft) px-3 py-2 text-sm text-(--teal)">
          {identity.name} · 근무 {identity.jobType || "미연결"} · 평가 {roles.find((r) => r.id === identity.evalRole)?.label || identity.evalRole || "미연결"}
        </span>
        {identity.isAdmin ? <span className="w-fit rounded-full bg-amber-100 px-3 py-2 text-sm text-amber-900">관리자</span> : null}
        <span className="text-sm text-stone-500">{identity.roleStatus === "review" ? "평가 직종 확인 필요" : "로그인됨 · 담당·준비는 기관에 저장됩니다"}</span>
        <button
          type="button"
          className="min-h-11 w-fit text-stone-500 underline"
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
    <div className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-3">
      <p className="text-sm leading-6 text-stone-600">로그인하면 담당과 준비 상태가 기관에 저장됩니다. 시연은 이 기기에서만 잠시 남습니다.</p>
      <form className="mt-2 flex w-full flex-col gap-2" onSubmit={(e) => void onLogin(e)}>
        <input
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={yymmdd}
          onChange={(e) => setYymmdd(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="생년월일 6자리"
          className="min-h-11 w-full rounded-full border border-stone-300 bg-white px-3 text-[16px]"
          autoComplete="username"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          className="min-h-11 w-full rounded-full border border-stone-300 bg-white px-3 text-[16px]"
          autoComplete="current-password"
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <button disabled={busy} className="min-h-11 flex-1 rounded-full bg-(--teal) px-4 text-sm font-medium text-white">
            {busy ? "로그인 중" : "로그인"}
          </button>
          <button type="button" className="min-h-11 flex-1 rounded-full border border-stone-300 px-4 text-sm" onClick={startDemo}>
            시연으로 둘러보기
          </button>
        </div>
        {msg ? <span className="text-sm text-amber-800">{msg}</span> : null}
      </form>
    </div>
  );
}

"use client";

import { FormEvent, useState, useSyncExternalStore } from "react";
import { useEvalSession } from "@/components/EvalSession";
import { roles } from "@/data/duties";

export function AuthBar() {
  const { mode, identity, startDemo, exitDemo, setDemoAdmin, refresh } = useEvalSession();
  const [yymmdd, setYymmdd] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const sessionReady = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!sessionReady) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className="min-h-11 rounded-full bg-(--teal) px-3 text-[13px] font-medium text-white">
          로그인
        </button>
        <button type="button" className="min-h-11 rounded-full border border-stone-300 px-3 text-[13px]">
          시연
        </button>
      </div>
    );
  }

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
      setOpen(false);
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
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
        <span className="font-semibold text-amber-800">시연</span>
        <span className="truncate text-stone-600">
          {identity?.name}
          {identity?.isAdmin ? " · 관리자" : " · 직원"}
        </span>
        <button type="button" className="min-h-11 rounded-full border border-stone-300 bg-white px-2.5" onClick={() => setDemoAdmin(!identity?.isAdmin)}>
          {identity?.isAdmin ? "직원으로" : "관리자로"}
        </button>
        <button type="button" className="min-h-11 rounded-full border border-stone-300 bg-white px-2.5" onClick={exitDemo}>
          시연 종료
        </button>
      </div>
    );
  }

  if (mode === "staff" && identity) {
    const role = roles.find((r) => r.id === identity.evalRole)?.label || identity.evalRole || "미연결";
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] leading-5">
        <span className="truncate text-stone-800">
          {identity.name} · {identity.jobType || "미연결"} · {role}
        </span>
        {identity.isAdmin ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">관리자</span> : null}
        {identity.roleStatus === "review" ? <span className="text-amber-800">직종 확인 필요</span> : null}
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

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className="min-h-11 rounded-full bg-(--teal) px-3 text-[13px] font-medium text-white" onClick={() => setOpen(true)}>
          로그인
        </button>
        <button type="button" className="min-h-11 rounded-full border border-stone-300 px-3 text-[13px]" onClick={startDemo}>
          시연
        </button>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl border border-stone-200 bg-white px-2.5 py-2">
      <form className="flex w-full flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center" onSubmit={(e) => void onLogin(e)}>
        <input
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={yymmdd}
          onChange={(e) => setYymmdd(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="생년월일 6자리"
          className="min-h-11 min-w-0 flex-1 rounded-full border border-stone-300 bg-white px-3 text-[16px] sm:max-w-44"
          autoComplete="username"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          className="min-h-11 min-w-0 flex-1 rounded-full border border-stone-300 bg-white px-3 text-[16px] sm:max-w-44"
          autoComplete="current-password"
        />
        <button disabled={busy} className="min-h-11 rounded-full bg-(--teal) px-4 text-sm font-medium text-white">
          {busy ? "로그인 중" : "로그인"}
        </button>
        <button type="button" className="min-h-11 rounded-full border border-stone-300 px-3 text-sm" onClick={startDemo}>
          시연
        </button>
        <button type="button" className="min-h-11 text-sm text-stone-500 underline" onClick={() => setOpen(false)}>
          닫기
        </button>
        {msg ? <span className="w-full text-sm text-amber-800">{msg}</span> : null}
      </form>
    </div>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

export function AuthBar() {
  const supabase = getSupabase();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user.email ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserEmail(session?.user.email ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  if (!supabase) return null;

  async function onAuth(e: FormEvent, mode: "in" | "up") {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMsg("");
    const fn =
      mode === "in"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });
    const { error } = await fn;
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setPassword("");
    if (mode === "up") setMsg("가입되었습니다. 메일 확인이 필요하면 받은편지함을 보세요.");
  }

  if (userEmail) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-(--teal-soft) px-2.5 py-1 text-(--teal)">{userEmail}</span>
        <span className="text-stone-500">집·회사 동기화</span>
        <button
          type="button"
          className="text-stone-500 underline"
          onClick={() => supabase.auth.signOut()}
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <form className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs" onSubmit={(e) => onAuth(e, "in")}>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="이메일"
        className="w-36 rounded-full border border-stone-300 bg-white px-3 py-1.5 outline-none focus:ring-2 focus:ring-(--teal)"
      />
      <input
        type="password"
        required
        minLength={6}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="비밀번호"
        className="w-28 rounded-full border border-stone-300 bg-white px-3 py-1.5 outline-none focus:ring-2 focus:ring-(--teal)"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-(--teal) px-3 py-1.5 font-medium text-white disabled:opacity-60"
      >
        로그인
      </button>
      <button
        type="button"
        disabled={busy}
        className="rounded-full border border-stone-300 px-3 py-1.5 text-stone-600"
        onClick={(e) => onAuth(e, "up")}
      >
        가입
      </button>
      {msg ? <span className="max-w-xs text-amber-800">{msg}</span> : null}
    </form>
  );
}

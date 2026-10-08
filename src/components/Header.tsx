"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AuthBar } from "@/components/AuthBar";
import { useEvalSession } from "@/components/EvalSession";

const baseNav = [
  { href: "/", label: "상황판" },
  { href: "/indicators", label: "지표" },
  { href: "/duties", label: "정기 업무" },
  { href: "/workflows", label: "연결 업무" },
];

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { identity, mode } = useEvalSession();
  const [q, setQ] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  useEffect(() => {
    setSessionReady(true);
  }, []);
  const nav =
    sessionReady && identity?.isAdmin
      ? [
          ...baseNav,
          ...(mode !== "demo"
            ? [
                { href: "/admin/manuals", label: "매뉴얼등록" },
                { href: "/admin/assignments", label: "담당배정" },
                { href: "/admin/admins", label: "관리자관리" },
              ]
            : []),
          { href: "/admin/ai-review", label: "AI 연결 검토" },
        ]
      : baseNav;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <header className="relative z-20 border-b border-(--line) bg-(--paper)">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <Link href="/" className="shrink-0">
            <p className="text-xs tracking-wide text-(--teal)">2025 시설급여</p>
            <h1 className="text-base font-semibold leading-tight">노인요양시설 평가</h1>
          </Link>
          <nav className="flex flex-wrap gap-1 sm:hidden">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full px-3 py-1 text-sm ${pathname === item.href || pathname.startsWith(item.href + "/") ? "bg-(--teal) text-white" : "text-stone-600"}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <form onSubmit={onSubmit} className="flex min-w-0 flex-1 gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="지표·직종 검색  예: 사회복지사"
            className="min-h-11 min-w-0 flex-1 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm outline-none ring-(--teal) focus:ring-2"
          />
          <button type="submit" className="min-h-11 rounded-full bg-(--teal) px-4 py-2 text-sm font-medium text-white">
            검색
          </button>
        </form>
        <nav className="hidden gap-1 sm:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
                className={`rounded-full px-3 py-1.5 text-sm ${pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/")) ? "bg-(--teal) text-white" : "text-stone-600 hover:bg-white"}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="mx-auto flex max-w-6xl justify-end px-4 pb-3">
        <AuthBar />
      </div>
    </header>
  );
}

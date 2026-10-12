"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { FormEvent, useState } from "react";
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
  const nav =
    identity?.isAdmin
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

  function navClass(href: string) {
    const on = pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
    return `inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full px-3 py-1 text-sm ${on ? "bg-(--teal) text-white" : "text-stone-600"}`;
  }

  return (
    <header className="relative z-20 border-b border-(--line) bg-(--paper) pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="min-w-0 shrink">
            <p className="text-[11px] tracking-wide text-(--teal)">2025 시설급여</p>
            <h1 className="text-[15px] font-semibold leading-tight sm:text-base">노인요양시설 평가</h1>
          </Link>
          <nav className="hidden min-w-0 flex-wrap justify-end gap-1 sm:flex">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className={navClass(item.href)}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <AuthBar />
        <form onSubmit={onSubmit} className="flex min-w-0 gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="지표·직종 검색  예: 사회복지사"
            className="min-h-11 min-w-0 flex-1 rounded-full border border-stone-300 bg-white px-4 py-2 text-[16px] outline-none ring-(--teal) focus:ring-2"
          />
          <button type="submit" className="min-h-11 shrink-0 rounded-full bg-(--teal) px-4 py-2 text-sm font-medium text-white">
            검색
          </button>
        </form>
        <nav className="flex flex-wrap gap-1 sm:hidden">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className={navClass(item.href)}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

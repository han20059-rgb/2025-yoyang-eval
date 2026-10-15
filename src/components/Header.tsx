"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthBar } from "@/components/AuthBar";
import { useEvalSession } from "@/components/EvalSession";
import { useClientReady } from "@/lib/useClientReady";

const baseNav = [
  { href: "/", label: "상황판" },
  { href: "/indicators", label: "지표" },
  { href: "/workflows", label: "연결 업무" },
];

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { identity, mode } = useEvalSession();
  const [q, setQ] = useState("");
  const sessionReady = useClientReady();
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

  function navClass(href: string) {
    const on = pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
    return `inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-[13px] sm:px-3 sm:text-sm ${on ? "bg-(--teal) text-white" : "text-stone-600"}`;
  }

  return (
    <header id="site-header" className="relative z-20 border-b border-(--line) bg-(--paper)">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-3 py-1 sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <Link href="/" className="min-w-0 shrink">
            <p className="text-[10px] leading-none tracking-wide text-(--teal)">2025 시설급여</p>
            <span className="block text-[14px] font-semibold leading-tight sm:text-[15px]">노인요양시설 평가</span>
          </Link>
          <div className="header-aux min-w-0">
            <AuthBar />
          </div>
        </div>
        <nav className="header-aux hidden min-w-0 flex-wrap gap-0.5 sm:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className={navClass(item.href)}>
              {item.label}
            </Link>
          ))}
        </nav>
        <form onSubmit={onSubmit} className="header-aux flex min-w-0 gap-1.5">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="지표·직종 검색  예: 사회복지사"
            className="min-h-11 min-w-0 flex-1 rounded-full border border-stone-300 bg-white px-3 text-[16px] outline-none ring-(--teal) focus:ring-2"
          />
          <button type="submit" className="min-h-11 shrink-0 rounded-full bg-(--teal) px-3 text-sm font-medium text-white">
            검색
          </button>
        </form>
        <nav className="header-aux flex flex-wrap gap-0.5 sm:hidden">
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

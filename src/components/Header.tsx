"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthBar } from "@/components/AuthBar";

const nav = [
  { href: "/", label: "요약" },
  { href: "/indicators", label: "지표" },
];

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <header className="sticky top-0 z-20 border-b border-(--line) bg-(--paper)/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="shrink-0">
            <p className="text-xs tracking-wide text-(--teal)">2025 시설급여</p>
            <h1 className="text-base font-semibold leading-tight">노인요양시설 평가</h1>
          </Link>
          <nav className="flex gap-1 sm:hidden">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-1 text-sm ${pathname === item.href ? "bg-(--teal) text-white" : "text-stone-600"}`}
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
            className="min-w-0 flex-1 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm outline-none ring-(--teal) focus:ring-2"
          />
          <button type="submit" className="rounded-full bg-(--teal) px-4 py-2 text-sm font-medium text-white">
            검색
          </button>
        </form>
        <nav className="hidden gap-1 sm:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-3 py-1.5 text-sm ${pathname === item.href ? "bg-(--teal) text-white" : "text-stone-600 hover:bg-white"}`}
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

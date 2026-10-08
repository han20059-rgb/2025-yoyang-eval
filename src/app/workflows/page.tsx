"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useWorkflows } from "@/components/WorkflowProvider";

export default function WorkflowsPage() {
  const { published, persistNote } = useWorkflows();
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = q.trim();
    if (!t) return published;
    return published.filter((w) => `${w.name} ${w.description} ${w.indicatorIds.join(" ")}`.includes(t));
  }, [published, q]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-(--teal)">업무 중심</p>
        <h2 className="text-xl font-bold">연결 업무</h2>
        <p className="mt-1 text-[15px] leading-7 text-stone-600">신규 입소, 처우개선, 사례관리처럼 업무로 찾습니다. 확정된 연결만 보입니다.</p>
        {persistNote ? <p className="text-sm text-stone-500">{persistNote}</p> : null}
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="업무명 또는 지표 번호" className="min-h-11 w-full rounded-xl border px-3 text-[16px]" />
      <ul className="space-y-2">
        {filtered.map((w) => (
          <li key={w.id}>
            <Link href={`/workflows/${w.id}`} className="block min-h-11 rounded-2xl border border-(--line) bg-(--card) px-4 py-3">
              <p className="text-[16px] font-semibold">{w.name}</p>
              <p className="text-[15px] leading-7 text-stone-600">{w.shortFlow}</p>
              <p className="text-sm text-stone-500">지표 {w.indicatorIds.join(", ")}</p>
            </Link>
          </li>
        ))}
      </ul>
      {filtered.length === 0 ? <p className="text-sm text-stone-500">확정된 연결 업무가 없습니다. 관리자가 적용한 뒤 여기에 나타납니다.</p> : null}
    </div>
  );
}

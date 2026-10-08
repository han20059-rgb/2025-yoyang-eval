"use client";

import { useState, type ReactNode } from "react";
import type { RoleId } from "@/data/duties";
import { paragraphIsMine, rolesMentionedIn } from "@/lib/evalCriteria";

export function restoreParagraphs(text: string) {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) {
      if (out.length && out[out.length - 1] !== "") out.push("");
      continue;
    }
    const prev = out[out.length - 1];
    const startsItem = /^([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮▣￭○●\-※]|기준\s*[①-⑮]|[가-힣]\.|[0-9]+\.)/.test(t);
    const prevClosed = !prev || prev === "" || /[.。함음됨임까요]$/.test(prev);
    if (prev && !startsItem && !prevClosed && prev.length < 90 && !prev.startsWith("▣")) {
      out[out.length - 1] = `${prev} ${t}`;
    } else {
      out.push(t);
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

export function OriginalProse({
  text,
  empty = "이 배포본에서 해당 칸을 가르지 못했습니다. 확인 필요",
  myRole = null,
  mineOnly = false,
}: {
  text: string;
  empty?: string;
  myRole?: RoleId | null;
  mineOnly?: boolean;
}) {
  const restored = restoreParagraphs(text || "");
  if (!restored.trim()) {
    return <p className="rounded-lg bg-amber-50 px-3 py-2 text-[15px] leading-7 text-amber-900">{empty}</p>;
  }
  return (
    <div className="space-y-2 text-[17px] leading-[1.7] break-keep text-stone-800">
      {restored.split("\n").map((line, i) => {
        if (!line) return <div key={i} className="h-2" />;
        const mentioned = rolesMentionedIn(line);
        const mine = paragraphIsMine(line, myRole);
        if (mineOnly && myRole && mentioned.length > 0 && !mine) return null;
        const joint = mentioned.filter((m) => m.role !== myRole);
        return (
          <div
            key={i}
            className={mine ? "rounded-lg bg-teal-50 px-2 py-2" : /^[▣￭①②③④⑤⑥⑦⑧⑨⑩]/.test(line) ? "pl-0" : undefined}
          >
            {mine ? (
              <p className="mb-1 text-[13px] font-semibold text-teal-800">{joint.length ? "공동 담당" : "내 담당"}</p>
            ) : null}
            <p>{line}</p>
            {mine && joint.length ? (
              <details className="mt-1 text-[14px] text-stone-600">
                <summary className="cursor-pointer">공동 담당 직종 이름</summary>
                {joint.map((j) => j.label).join(" · ")}
              </details>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function LawAccordion({ blocks }: { blocks: { title: string; text: string }[] }) {
  if (!blocks.length) {
    return <OriginalProse text="" empty="관련근거를 이 배포본에서 구분하지 못했습니다. 확인 필요" />;
  }
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => (
        <details key={i} className="rounded-xl border border-stone-200 bg-white">
          <summary className="min-h-11 cursor-pointer list-none px-3 py-3 text-[16px] font-semibold leading-6 text-(--teal)">
            {b.title}
          </summary>
          <div className="border-t border-stone-100 px-3 py-3">
            <OriginalProse text={b.text} />
          </div>
        </details>
      ))}
    </div>
  );
}

export function ZoomBox({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-left text-[15px]">
        {title} · 확대 보기
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-3 sm:items-center" onClick={() => setOpen(false)}>
          <div className="max-h-[90vh] w-full overflow-auto rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex justify-between gap-2">
              <p className="font-semibold">{title}</p>
              <button type="button" className="min-h-11 rounded-full bg-stone-200 px-4" onClick={() => setOpen(false)}>
                닫기
              </button>
            </div>
            <div className="min-w-0 overflow-x-auto text-[17px] leading-7">{children}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}

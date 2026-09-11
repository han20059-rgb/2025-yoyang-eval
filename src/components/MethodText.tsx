"use client";

import { Highlight } from "@/components/Highlight";
import { methodFromMatch, splitMethodText } from "@/lib/evalCriteria";

export function MethodText({
  text,
  query,
  emphasize,
}: {
  text: string;
  query?: string;
  emphasize?: boolean;
}) {
  if (!text?.trim()) {
    return <p className="text-stone-400">해당 내용이 없습니다.</p>;
  }
  if (!emphasize) {
    return (
      <div className="prose-manual text-stone-800">
        <Highlight text={text} query={query} />
      </div>
    );
  }
  const parts = splitMethodText(text);
  return (
    <div className="prose-manual text-stone-800">
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          const def = methodFromMatch(part);
          return (
            <span key={i} className={def.word}>
              {part}
            </span>
          );
        }
        return <Highlight key={i} text={part} query={query} />;
      })}
    </div>
  );
}

export function MethodChips({ methods, pulse }: { methods: { label: string; chip: string }[]; pulse?: boolean }) {
  if (!methods.length) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {methods.map((m, i) => (
        <span key={m.label} className={m.chip} style={{ animationDelay: `${i * 0.18}s` }}>
          {pulse ? m.label : m.label}
        </span>
      ))}
    </span>
  );
}

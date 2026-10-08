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
    <span className="inline-flex max-w-full flex-wrap items-center gap-1">
      {methods.map((m, i) => (
        <span key={m.label} className={m.chip} style={pulse ? { animationDelay: `${i * 0.18}s` } : undefined}>
          {m.label}
        </span>
      ))}
    </span>
  );
}

export function MethodHeading({ methods, isNew }: { methods: { label: string; chip: string }[]; isNew?: boolean }) {
  if (!methods.length && !isNew) return null;
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-1">
      <MethodChips methods={methods} pulse />
      {isNew ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">신설</span> : null}
    </span>
  );
}

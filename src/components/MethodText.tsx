"use client";

import { EvalBadges } from "@/components/EvalBadges";
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

export function MethodChips({ methods }: { methods: { label: string; chip: string }[]; pulse?: boolean }) {
  return <EvalBadges methods={methods} />;
}

export function MethodHeading({
  methods,
  isNew,
  isChanged,
  delay = 0,
}: {
  methods: { label: string; chip: string }[];
  isNew?: boolean;
  isChanged?: boolean;
  delay?: number;
}) {
  return <EvalBadges changeKind={isNew ? "new" : isChanged ? "changed" : null} methods={methods} delay={delay} />;
}

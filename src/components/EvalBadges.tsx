import type { CSSProperties } from "react";
import type { ChangeKind } from "@/lib/evalCriteria";

const CHANGE_LABEL: Record<ChangeKind, string> = {
  new: "신설",
  "partial-new": "일부 기준 신설",
  changed: "변경",
};

export function ChangeBadge({ kind, delay = 0 }: { kind: ChangeKind | null | undefined; delay?: number }) {
  if (!kind) return null;
  const bob = kind === "new" || kind === "partial-new";
  return (
    <span
      className={`eval-badge eval-badge-${kind}${bob ? " eval-badge-bob" : ""}`}
      style={bob ? ({ "--badge-delay": `${delay}s` } as CSSProperties) : undefined}
    >
      {CHANGE_LABEL[kind]}
    </span>
  );
}

export function MethodBadges({ methods }: { methods: { label: string; chip: string }[] }) {
  if (!methods.length) return null;
  return (
    <>
      {methods.map((m) => (
        <span key={m.label} className={m.chip}>
          {m.label}
        </span>
      ))}
    </>
  );
}

export function EvalBadges({
  changeKind,
  methods = [],
  delay = 0,
}: {
  changeKind?: ChangeKind | null;
  methods?: { label: string; chip: string }[];
  delay?: number;
}) {
  if (!changeKind && !methods.length) return null;
  return (
    <span className="eval-badge-row">
      <ChangeBadge kind={changeKind} delay={delay} />
      <MethodBadges methods={methods} />
    </span>
  );
}

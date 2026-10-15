import type { ChangeKind } from "@/lib/evalCriteria";

const CHANGE_LABEL: Record<ChangeKind, string> = {
  new: "신설",
  "partial-new": "일부 기준 신설",
  changed: "변경",
};

export function ChangeBadge({ kind }: { kind: ChangeKind | null | undefined }) {
  if (!kind) return null;
  return <span className={`eval-badge eval-badge-${kind}`}>{CHANGE_LABEL[kind]}</span>;
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
}: {
  changeKind?: ChangeKind | null;
  methods?: { label: string; chip: string }[];
}) {
  if (!changeKind && !methods.length) return null;
  return (
    <span className="eval-badge-row">
      <ChangeBadge kind={changeKind} />
      <MethodBadges methods={methods} />
    </span>
  );
}

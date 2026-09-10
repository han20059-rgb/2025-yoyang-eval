import { escapeRegExp } from "@/lib/search";

export function Highlight({ text, query }: { text: string; query?: string }) {
  const q = query?.trim();
  if (!q) return <>{text}</>;
  const pattern = q === "사회복지사" ? `(${escapeRegExp(q)}(?!업))` : `(${escapeRegExp(q)})`;
  const parts = text.split(new RegExp(pattern, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>
      )}
    </>
  );
}

function compact(s: string) {
  return s.replace(/\s+/g, "").replace(/[·∙•\-]/g, "");
}

export function isAddedLine(line: string, prev: string) {
  const t = line.trim();
  if (t.length < 12) return false;
  if (/^(평가지표|평가기준|평가방법|평가방향|기준 점수|채점기준|척도)/.test(t)) return false;
  const piece = compact(t).slice(0, 28);
  if (piece.length < 10) return false;
  return !compact(prev).includes(piece);
}

export function ManualText({
  text,
  query,
  prevForDiff,
}: {
  text: string;
  query?: string;
  prevForDiff?: string;
}) {
  if (!text?.trim()) {
    return <p className="text-stone-400">해당 내용이 없습니다.</p>;
  }
  if (!prevForDiff) {
    return (
      <div className="prose-manual text-stone-800">
        <Highlight text={text} query={query} />
      </div>
    );
  }
  return (
    <div className="prose-manual text-stone-800">
      {text.split("\n").map((line, i) => {
        const added = isAddedLine(line, prevForDiff);
        if (!line) return <div key={i} className="h-2" />;
        return (
          <div
            key={i}
            className={added ? "my-0.5 rounded-md bg-amber-100/90 px-1.5 py-0.5 ring-1 ring-amber-300/80" : undefined}
          >
            {added ? <span className="mr-1 text-[10px] font-semibold text-amber-800">달라짐</span> : null}
            <Highlight text={line} query={query} />
          </div>
        );
      })}
    </div>
  );
}

export function extractPurpose(intro: string) {
  const lines = intro
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^평가지표/.test(l) && l !== "점수" && !/^\d+$/.test(l));
  const purpose = lines.find((l) => l.includes("평가합니다")) || "";
  const goal = lines.find((l) => /합니다\.?$/.test(l) && !l.includes("평가합니다")) || "";
  return { goal, purpose };
}

export function splitScoring(criteria: string) {
  const idx = criteria.search(/기준\s*점수|채점기준|척도\s+점수/);
  if (idx < 0) return { body: criteria.replace(/^평가기준[^\n]*/, "").trim(), scoring: "" };
  return {
    body: criteria.slice(0, idx).replace(/^평가기준[^\n]*/, "").trim(),
    scoring: criteria.slice(idx).trim(),
  };
}

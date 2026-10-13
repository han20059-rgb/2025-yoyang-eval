"use client";

function splitByPhrases(text: string, phrases: string[]) {
  const found = phrases.filter((p) => p && text.includes(p)).sort((a, b) => b.length - a.length);
  if (!found.length) return [{ text, strong: false }];
  const parts: { text: string; strong: boolean }[] = [];
  let rest = text;
  while (rest) {
    let hit = "";
    let at = -1;
    for (const p of found) {
      const i = rest.indexOf(p);
      if (i >= 0 && (at < 0 || i < at)) {
        at = i;
        hit = p;
      }
    }
    if (at < 0 || !hit) {
      parts.push({ text: rest, strong: false });
      break;
    }
    if (at > 0) parts.push({ text: rest.slice(0, at), strong: false });
    parts.push({ text: hit, strong: true });
    rest = rest.slice(at + hit.length);
  }
  return parts;
}

export function EmphText({ text, phrases }: { text: string; phrases?: string[] }) {
  if (!phrases?.length) return <span>{text}</span>;
  return (
    <>
      {splitByPhrases(text, phrases).map((p, i) =>
        p.strong ? (
          <strong key={`${p.text}-${i}`} className="font-bold text-stone-950">
            {p.text}
          </strong>
        ) : (
          <span key={`${p.text}-${i}`}>{p.text}</span>
        )
      )}
    </>
  );
}

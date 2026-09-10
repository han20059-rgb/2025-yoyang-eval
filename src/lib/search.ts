import type { Indicator } from "@/lib/types";

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeQuery(q: string) {
  return q.trim().replace(/\s+/g, " ");
}

type Field = { key: string; label: string; text: string };

function fieldsOf(ind: Indicator): Field[] {
  return [
    { key: "name", label: "지표명", text: `${ind.id}번 ${ind.name}` },
    { key: "note", label: "달라진 점", text: ind.changeNote },
    { key: "criteria", label: "평가기준", text: ind.curr.criteria },
    { key: "method", label: "확인방법", text: ind.curr.method },
    { key: "intro", label: "평가방향", text: ind.curr.intro },
    { key: "law", label: "관련근거", text: ind.curr.law },
    { key: "prev", label: "이전 평가", text: ind.prev.text },
    { key: "body", label: "이번 평가 본문", text: ind.curr.text },
  ];
}

export type Snippet = {
  field: string;
  label: string;
  text: string;
};

export type SearchHit = {
  id: number;
  name: string;
  area: string;
  sub: string;
  score: number;
  isNew: boolean;
  matchCount: number;
  snippets: Snippet[];
};

function queryRegex(query: string) {
  const escaped = escapeRegExp(query);
  if (query === "사회복지사") return new RegExp(`${escaped}(?!업)`, "gi");
  return new RegExp(escaped, "gi");
}

function collectSnippets(text: string, query: string, limit: number): string[] {
  if (!text || !query) return [];
  const re = queryRegex(query);
  const out: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && out.length < limit) {
    const start = Math.max(0, m.index - 52);
    const end = Math.min(text.length, m.index + query.length + 72);
    const snip = (start > 0 ? "…" : "") + text.slice(start, end).replace(/\s+/g, " ").trim() + (end < text.length ? "…" : "");
    if (seen.has(snip)) continue;
    seen.add(snip);
    out.push(snip);
    if (m.index === re.lastIndex) re.lastIndex += 1;
  }
  return out;
}

export function searchIndicators(indicators: Indicator[], rawQuery: string): SearchHit[] {
  const query = normalizeQuery(rawQuery);
  if (!query) return [];
  const hits: SearchHit[] = [];

  for (const ind of indicators) {
    const snippets: Snippet[] = [];
    let matchCount = 0;
    for (const field of fieldsOf(ind)) {
      const re = queryRegex(query);
      const count = (field.text.match(re) || []).length;
      if (!count) continue;
      matchCount += count;
      for (const text of collectSnippets(field.text, query, 3)) {
        snippets.push({ field: field.key, label: field.label, text });
      }
    }
    if (matchCount === 0) continue;
    hits.push({
      id: ind.id,
      name: ind.name,
      area: ind.area,
      sub: ind.sub,
      score: ind.score,
      isNew: ind.isNew,
      matchCount,
      snippets: snippets.slice(0, 6),
    });
  }

  hits.sort((a, b) => b.matchCount - a.matchCount || a.id - b.id);
  return hits;
}

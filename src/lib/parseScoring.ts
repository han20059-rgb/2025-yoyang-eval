export type ScoringRow = {
  score: string;
  condition: string;
  notes: string[];
};

export type ScoringGroup = {
  marks: string;
  rows: ScoringRow[];
};

export type ScoringParsed = {
  groups: ScoringGroup[];
  notes: string[];
  uncertain: boolean;
};

const HEADER = /^(?:기준\s*점수\s*)?채점기준$/;
const MARK_TOKEN = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
const MARKS_AT = new RegExp(
  `^([${MARK_TOKEN}](?:\\s*[~～∼\\-]\\s*[${MARK_TOKEN}])?(?:\\s*[,，]\\s*[${MARK_TOKEN}])*)(?!번)`
);

function isNoteLine(line: string) {
  return /^(?:※|\(예시\)|총점|산정|환산|주\)|주:)/.test(line) || /환산\s*식/.test(line);
}

function takeMarks(line: string): { marks: string; rest: string } | null {
  const m = line.match(MARKS_AT);
  if (!m) return null;
  const after = line.slice(m[0].length);
  if (after.startsWith("번")) return null;
  if (after && !/^\s/.test(after) && !/^\d/.test(after)) return null;
  return { marks: m[1].replace(/\s+/g, ""), rest: after.trim() };
}

function takeScore(line: string): { score: string; rest: string } | null {
  const m = line.match(/^(\d+(?:\.\d+)?)(?:점)?(?:\s+|$)(.*)$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n > 10) return null;
  const rest = m[2].trim();
  if (/^(?:개|명|회|쪽|항목)(?:\s|$)/.test(rest)) return null;
  return { score: m[1], rest };
}

function formatMarks(raw: string) {
  return raw.replace(/[~～∼\-]/g, "~").replace(/,/g, "·");
}

export function parseScoring(text: string): ScoringParsed {
  const lines = text
    .replace(/^(?:기준\s*점수\s*)?채점기준\s*/, "")
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l && !HEADER.test(l));

  const groups: ScoringGroup[] = [];
  const trailingNotes: string[] = [];
  const box: { current: ScoringGroup | null } = { current: null };
  let pendingCondition = "";
  let uncertain = false;
  let noteMode = false;

  function ensureGroup(marks: string) {
    const current = box.current;
    if (current && !current.marks && marks) {
      current.marks = marks;
      return current;
    }
    if (current && current.marks === marks) return current;
    box.current = { marks, rows: [] };
    groups.push(box.current);
    return box.current;
  }

  function addRow(marks: string, score: string, condition: string) {
    const g = ensureGroup(marks);
    g.rows.push({ score, condition: condition.trim(), notes: [] });
    pendingCondition = "";
  }

  function lastRow() {
    const current = box.current;
    return current?.rows[current.rows.length - 1] || null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1] || "";
    if (isNoteLine(line) || /^\(/.test(line) || (noteMode && !takeMarks(line) && !takeScore(line))) {
      noteMode = true;
      const row = lastRow();
      if (row && box.current && box.current.rows.length) row.notes.push(line);
      else trailingNotes.push(line);
      continue;
    }
    noteMode = false;

    const marked = takeMarks(line);
    const body = marked ? marked.rest : line;
    const scored = body ? takeScore(body) : null;
    const nextMarks = takeMarks(next);
    if (scored && !marked && box.current?.marks && box.current.rows.length >= 2 && nextMarks && formatMarks(nextMarks.marks) !== box.current.marks) {
      box.current = null;
    }
    const marks = marked ? formatMarks(marked.marks) : box.current?.marks || "";

    if (marked && !body) {
      if (box.current && box.current.rows.length && !box.current.marks) box.current.marks = formatMarks(marked.marks);
      else ensureGroup(formatMarks(marked.marks));
      continue;
    }

    if (marked && body && !scored) {
      if (box.current && box.current.rows.length && !box.current.marks) box.current.marks = formatMarks(marked.marks);
      else ensureGroup(formatMarks(marked.marks));
      pendingCondition = body;
      continue;
    }

    if (scored) {
      const condition = [pendingCondition, scored.rest].filter(Boolean).join(" ").trim();
      addRow(marks, scored.score, condition);
      continue;
    }

    const row = lastRow();
    if (row) {
      row.condition = `${row.condition} ${line}`.trim();
    } else {
      trailingNotes.push(line);
      uncertain = true;
    }
  }

  if (pendingCondition) {
    const row = lastRow();
    if (row && !row.condition) row.condition = pendingCondition;
    else if (row) row.notes.push(pendingCondition);
    else uncertain = true;
  }

  for (const g of groups) {
    if (!g.rows.length) uncertain = true;
  }

  return { groups: groups.filter((g) => g.rows.length), notes: trailingNotes, uncertain };
}

import { parseScoring } from "@/lib/parseScoring";

export function ScoringCriteria({ text }: { text: string }) {
  const parsed = parseScoring(text || "");
  if (!parsed.groups.length) {
    return <p className="whitespace-pre-wrap text-[16px] leading-7">{text}</p>;
  }
  return (
    <div className="space-y-3">
      {parsed.groups.map((g, i) => (
        <section key={`${g.marks}-${i}`} className="rounded-xl border border-stone-200 bg-stone-50/80 px-3 py-3">
          {g.marks ? (
            <p className="mb-2 text-[15px] font-semibold text-stone-800">기준 {g.marks}</p>
          ) : (
            <p className="mb-2 text-[13px] text-stone-500">기준 번호가 원문에 붙지 않은 배점</p>
          )}
          <ul className="space-y-2">
            {g.rows.map((row, j) => (
              <li key={`${row.score}-${j}`} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 border-t border-stone-200 pt-2 first:border-t-0 first:pt-0">
                <p className="shrink-0 text-[22px] font-bold leading-7 tracking-tight text-stone-900">
                  {row.score}
                  <span className="ml-0.5 text-[14px] font-semibold">점</span>
                </p>
                <div className="min-w-0">
                  <p className="text-[16px] leading-7 break-words">{row.condition || "조건 문장이 이 줄에 없습니다."}</p>
                  {row.notes.map((n) => (
                    <p key={n} className="mt-1 text-[14px] leading-6 text-stone-600">
                      {n}
                    </p>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {parsed.notes.map((n) => (
        <p key={n} className="whitespace-pre-wrap text-[15px] leading-7 text-stone-700">
          {n}
        </p>
      ))}
    </div>
  );
}

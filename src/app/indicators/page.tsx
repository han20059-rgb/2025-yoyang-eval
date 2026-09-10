import Link from "next/link";
import manual from "@/data/manual.json";
import type { Manual } from "@/lib/types";

const data = manual as Manual;

export default function IndicatorsPage() {
  const areas = [...new Set(data.indicators.map((i) => i.area))];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold">2025 평가지표 45개</h2>
        <p className="mt-1 text-sm text-stone-600">영역을 고르고 지표를 열면 이전 평가와 나란히 볼 수 있습니다.</p>
      </div>
      {areas.map((area) => {
        const items = data.indicators.filter((i) => i.area === area);
        const score = items.reduce((s, i) => s + i.score, 0);
        return (
          <section key={area}>
            <h3 className="mb-3 flex items-baseline gap-2 text-lg font-semibold">
              {area}
              <span className="text-sm font-normal text-stone-500">
                {items.length}개 · {score}점
              </span>
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {items.map((i) => (
                <Link
                  key={i.id}
                  href={`/indicators/${i.id}`}
                  className="flex items-start gap-3 rounded-xl border border-(--line) bg-(--card) px-4 py-3 hover:border-(--teal)"
                >
                  <span className="mt-0.5 w-8 shrink-0 text-right text-sm font-semibold text-(--teal)">{i.id}</span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{i.name}</span>
                      {i.isNew ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                          신설
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-stone-500">
                      {i.sub} · {i.score}점
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

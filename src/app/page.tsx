import Link from "next/link";
import { DutyBoard } from "@/components/DutyBoard";
import { ProgressBoard } from "@/components/ProgressBoard";
import { loadManual } from "@/lib/manual";

export default async function HomePage() {
  const data = await loadManual();
  const { scoreboard, new2025, removed2021 } = data;

  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-(--teal) px-5 py-6 text-white sm:px-6">
        <p className="text-xs text-white/75">2021 매뉴얼(왼쪽) · 2025 매뉴얼(오른쪽)</p>
        <h2 className="mt-1 text-2xl font-bold">이번 평가 한 줄</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/90">
          지표 50개→45개. 법정 인력·시설 확인은 빠지고, 직원 인권·개별 욕구·구강·목욕·생애말기 돌봄을
          봅니다. 적용기간 2022.1.~평가일.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {scoreboard.curr.domains.map((d) => (
            <div key={d.name} className="rounded-xl bg-white/10 px-3 py-2">
              <dt className="text-xs text-white/70">{d.name}</dt>
              <dd className="font-semibold">
                {d.items}문항 {d.score}점
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <ProgressBoard indicators={data.indicators} />

      <DutyBoard indicators={data.indicators} />

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">달라진 점만</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              t: "직원",
              d: "직원인권보호 신설. 지침 10개→13개. 직원건강관리 4점.",
            },
            {
              t: "수급자",
              d: "개별욕구·구강·목욕·생애말기돌봄이 새로 생겼습니다.",
            },
            {
              t: "결과",
              d: "기능회복 계획, 관절구축, 체중, 백신, 욕창 회복, 장기근속.",
            },
            {
              t: "방식",
              d: "직전 평가 충족(Y)이면 일부는 전산 인정. 현장·면담·시연은 평가 당일.",
            },
          ].map((item) => (
            <article key={item.t} className="rounded-2xl border border-(--line) bg-(--card) p-4">
              <h4 className="font-semibold text-(--teal)">{item.t}</h4>
              <p className="mt-1 text-sm leading-relaxed text-stone-700">{item.d}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-(--line) bg-(--card) p-5">
          <h3 className="font-semibold">신설 {new2025.length}개</h3>
          <ul className="mt-3 columns-1 gap-x-6 space-y-1 text-sm sm:columns-2">
            {new2025.map((i) => (
              <li key={i.id} className="break-inside-avoid">
                <Link className="text-(--teal) hover:underline" href={`/indicators/${i.id}`}>
                  {i.id}. {i.name}
                </Link>
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-2xl border border-(--line) bg-(--card) p-5">
          <h3 className="font-semibold">빠진 2021 지표</h3>
          <ul className="mt-3 space-y-1 text-sm text-stone-700">
            {removed2021.map((i) => (
              <li key={i.id}>
                {i.id}. {i.name}
              </li>
            ))}
          </ul>
          <Link href="/indicators" className="mt-4 inline-block text-sm text-(--teal) underline">
            45개 지표 모두 보기
          </Link>
        </article>
      </section>
    </div>
  );
}

import Link from "next/link";
import manual from "@/data/manual.json";
import type { Manual } from "@/lib/types";

const data = manual as Manual;

export default function HomePage() {
  const { scoreboard, new2025, removed2021 } = data;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-(--teal) px-6 py-8 text-white">
        <p className="text-sm text-white/80">좌측 2021년 매뉴얼 · 우측 2025년 매뉴얼</p>
        <h2 className="mt-1 text-2xl font-bold">이번 평가, 무엇이 달라졌나</h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/90">
          지표는 50개에서 45개로 줄었고, 점수는 기관운영 28 · 수급자존중 24 · 서비스제공 25 · 서비스결과 23으로
          재편되었습니다. 법정 인력·시설 기준 확인은 빠지고, 직원 인권·개별 욕구·구강·목욕·생애말기 돌봄 등
          현장 서비스 질이 앞에 나왔습니다.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-(--line) bg-(--card) p-5">
          <p className="text-xs font-medium text-stone-500">이전 평가 (2021)</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>지표 {scoreboard.prev.indicators}개 · 우수/양호/보통/미흡 척도</li>
            <li>적용기간 {scoreboard.prev.period}</li>
            <li>종이 평가조사표에 서명·날인</li>
            {scoreboard.prev.domains.map((d) => (
              <li key={d} className="text-stone-600">
                {d}점
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-2xl border border-(--teal) bg-(--teal-soft) p-5">
          <p className="text-xs font-medium text-(--teal)">이번 평가 (2025)</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>지표 {scoreboard.curr.indicators}개 · 지표별 기준 점수</li>
            <li>적용기간 {scoreboard.curr.period}</li>
            <li>기관포털 전자평가조사표 전송·열람 확인</li>
            {scoreboard.curr.domains.map((d) => (
              <li key={d.name}>
                {d.name} {d.items}문항 {d.score}점
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">이번 평가에서 강조하는 점</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              t: "직원 인권·교육",
              d: "직원인권보호가 신설되었고, 급여제공지침이 10개에서 13개(인권침해 대응, 고충처리, 야간근무)로 늘었습니다. 직원건강관리는 4점입니다.",
            },
            {
              t: "수급자 한 사람",
              d: "개별욕구존중, 구강관리, 목욕 서비스, 생애말기돌봄이 새로 생겼습니다. 획일 서비스보다 개인 맞춤을 봅니다.",
            },
            {
              t: "건강 결과",
              d: "기능회복훈련 계획, 관절구축 예방, 체중관리, 백신 접종률, 욕창 회복을 결과로 확인합니다. 투약·약품은 1점에서 3점으로 올랐습니다.",
            },
            {
              t: "평가 방식",
              d: "직전 정기평가에서 충족(Y)이면 일부 기준을 공단 전산으로 인정합니다. 현장·면담·시연 지표는 평가 당일을 봅니다.",
            },
          ].map((item) => (
            <article key={item.t} className="rounded-2xl border border-(--line) bg-(--card) p-4">
              <h4 className="font-semibold text-(--teal)">{item.t}</h4>
              <p className="mt-2 text-sm leading-relaxed text-stone-700">{item.d}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-(--line) bg-(--card) p-5">
          <h3 className="font-semibold">신설 지표 {new2025.length}개</h3>
          <ul className="mt-3 space-y-1 text-sm">
            {new2025.map((i) => (
              <li key={i.id}>
                <Link className="text-(--teal) hover:underline" href={`/indicators/${i.id}`}>
                  {i.id}. {i.name}
                </Link>
                <span className="text-stone-500"> · {i.score}점 · {i.area}</span>
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-2xl border border-(--line) bg-(--card) p-5">
          <h3 className="font-semibold">평가에서 빠진 2021 지표</h3>
          <p className="mt-1 text-xs text-stone-500">인력·시설 법정기준, 일부 결과 통계 지표</p>
          <ul className="mt-3 space-y-1 text-sm text-stone-700">
            {removed2021.map((i) => (
              <li key={i.id}>
                {i.id}. {i.name}
              </li>
            ))}
          </ul>
        </article>
      </section>

      <p className="text-center text-sm text-stone-500">
        위 검색창에 직종·업무를 넣으면 관련 지표를 순서대로 볼 수 있습니다.{" "}
        <Link href="/indicators" className="text-(--teal) underline">
          전체 지표 보기
        </Link>
      </p>
    </div>
  );
}

import type { PracticeGuide } from "@/lib/practiceGuide";

const E = {
  d14: "14일",
  holiday: "공휴일",
  h72: "연속 72시간",
  sleep: "수면시간 포함",
  hourly: "매시간",
  next: "다음날까지",
  now: "지체 없이",
};

export const indicator28Practice: PracticeGuide = {
  indicatorId: 28,
  kind: "practice",
  title: "배설관리 실무 흐름",
  status: "in-review",
  approved: false,
  aiGenerated: false,
  adminReviewHook: "ai-review",
  linkReason:
    "원문은 기준①에서 신규 입소 관찰과 계획 반영을, 기준②에서 실제 배설 조치를 나눈다. 관찰 기록만으로 ②를 충족했다고 보지 않는다.",
  source: {
    pdfFile: "official/2025-eval-manual.pdf",
    versionLabel: "첨부 2025 평가매뉴얼 PDF 로컬 미리보기",
    pdfSha12: "1e515ac43a8e",
    pageStart: 135,
    pageEnd: 136,
    quotes: [
      {
        mark: "①",
        filePage: 135,
        quote:
          "신규 수급자의 배설상태를 파악한다. ∙ 신규 수급자: 급여개시일로부터 공휴일을 포함하여 14일 이내에 집중배설관찰 기록표 작성 … 3일(수면시간포함 연속 72시간)동안 매 시간 섭취량, 대·소변 여부, 기저귀 및 옷 교환 여부 기록",
      },
      {
        mark: "②",
        filePage: 136,
        quote: "기저귀 교체 시 기저귀 교환 시간을 기록하여야 함 - 기저귀 교환 시간을 정하여 주기적으로 교환한 경우는 인정하지 않음",
      },
    ],
  },
  cards: [
    {
      mark: "①",
      title: "신규 수급자 배설상태 파악",
      bands: [
        {
          kind: "do",
          title: "해야 할 일 · 남길 기록",
          groups: [
            {
              heading: "신규 입소 → 집중배설관찰 → 필요한 계획 변경",
              items: [
                { text: "급여개시일부터 공휴일을 포함하여 14일 이내에 집중배설관찰을 시작한다.", emphasis: [E.holiday, E.d14] },
                { text: "3일 동안 연속 72시간(수면시간 포함) 매시간 배설상태를 기록한다. 매시간 섭취량, 대·소변 여부, 기저귀 및 옷 교환 여부를 남긴다.", emphasis: [E.h72, E.sleep, E.hourly] },
                { text: "관찰 결과 배설상태에 문제가 있어 급여제공계획 변경이 필요하면 집중배설기록지 작성 완료일 다음날까지 반영한다.", emphasis: [E.next] },
              ],
            },
          ],
        },
        {
          kind: "when",
          title: "기한·주기 · 꼭 확인할 조건",
          groups: [
            {
              items: [
                { text: "신규 수급자: 급여개시일로부터 공휴일 포함 14일 이내.", emphasis: [E.holiday, E.d14] },
                { text: "관찰: 연속 72시간, 수면시간 포함, 매시간.", emphasis: [E.h72, E.sleep, E.hourly] },
                { text: "계획 변경이 필요하면 작성 완료일 다음날까지.", emphasis: [E.next] },
              ],
            },
          ],
        },
        {
          kind: "deny",
          title: "불인정·주의",
          groups: [
            {
              items: [
                { text: "작성 완료 다음날까지 필요한 계획 변경을 반영하지 않으면 인정하지 않는다.", emphasis: [E.next] },
                { text: "관찰기록만 작성했다고 기준②(실제 배설 조치)까지 충족된 것으로 보지 않는다." },
              ],
            },
          ],
        },
      ],
      details: [
        {
          title: "입원·외박으로 14일 내 관찰을 못 한 경우",
          filePage: 136,
          text: "신규 수급자가 입소 후 14일차까지 외박(입원 등)하여 집중배설관찰을 수행할 수 없는 경우, 복귀 즉시 집중배설관찰을 실시하고 기록한다.",
        },
        {
          title: "혈액투석 등 병원 진료 시간",
          filePage: 136,
          text: "신규 수급자가 혈액투석으로 계속 병원 진료를 받아 연속 72시간 집중배설관찰을 수행할 수 없는 경우, 병원진료 시간은 예외로 인정한다. 집중배설관찰 72시간은 진행하되 병원진료시간은 사유를 작성한 뒤 공란으로 둔다. (사유 예시: 혈액투석 07:00~14:00)",
        },
        {
          title: "적용기간",
          filePage: 135,
          text: "지표적용기간: 2022.1월 ~ 2025년 평가일. 기준①의 ‘급여제공계획 변경이 필요한 경우 다음날까지 반영’은 평가계획 공고월의 다음 달부터 적용한다.",
        },
      ],
    },
    {
      mark: "②",
      title: "실제 배설 조치",
      bands: [
        {
          kind: "do",
          title: "해야 할 일 · 남길 기록",
          groups: [
            {
              items: [
                { text: "배설관리가 필요한 수급자에게 적절한 조치를 취한다. 기저귀 사용 수급자는 배설 확인 후 지체 없이 교환한다.", emphasis: [E.now] },
                { text: "실제 기저귀 교환 시간을 기록한다." },
              ],
            },
          ],
        },
        {
          kind: "when",
          title: "기한·주기 · 꼭 확인할 조건",
          groups: [
            {
              items: [{ text: "배설 확인 후 지체 없이 교환한다.", emphasis: [E.now] }],
            },
          ],
        },
        {
          kind: "deny",
          title: "불인정·주의",
          groups: [
            {
              items: [
                { text: "기저귀 교환 시간을 정해 두고 주기적으로 기저귀만 교환한 경우는 인정하지 않는다." },
                { text: "교환 시간을 기록하지 않으면 인정하지 않는다." },
              ],
            },
          ],
        },
      ],
    },
  ],
};

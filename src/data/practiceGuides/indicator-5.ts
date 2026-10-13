import type { PracticeGuide } from "@/lib/practiceGuide";

const E = {
  year: "연 1회",
  tb: "결핵검진",
  five: "5개 영역",
  edi: "EDI",
  start: "근무 시작일까지",
  yearIn: "입사 전 1년 이내",
  exam: "검진일",
  judge: "판정일",
  issue: "발행일",
  recv: "수령",
  pct: "95%",
  one: "1개 이상",
};

/** 실무 안내 시안. 공식 원문이 아니며 관리자 승인 전이다. AI 생성이 아니다. */
export const indicator5Practice: PracticeGuide = {
  indicatorId: 5,
  kind: "practice",
  title: "직원건강관리",
  status: "in-review",
  approved: false,
  aiGenerated: false,
  adminReviewHook: "ai-review",
  linkReason:
    "기준①은 기존 직원(연 1회·EDI)과 신규 직원(근무 시작일까지 결과통보서)을 나눠 확인한다. 1점은 평가기준 충족, 0.75점은 건강검진 비율 95% 이상이다.",
  source: {
    pdfFile: "official/2025-eval-manual.pdf",
    versionLabel: "첨부 2025 평가매뉴얼 PDF 로컬 미리보기",
    pdfSha12: "1e515ac43a8e",
    pageStart: 30,
    pageEnd: 36,
    quotes: [
      {
        mark: "①",
        filePage: 30,
        quote: "모든 직원은 결핵검진을 포함한 건강검진을 매년 실시한다. ∙ 5개 영역 충족 : 계측검사, 요검사, 혈액검사, 영상검사 및 판정 ∙ 신규입사자는 근무 시작일자까지 건강검진 결과통보서 제출",
      },
      {
        mark: "①",
        filePage: 31,
        quote: "1 평가기준을 충족함 / 0.75 건강검진 비율을 95%이상 충족함 (검진율 소수점 첫째자리에서 반올림)",
      },
    ],
  },
  cards: [
    {
      mark: "①",
      title: "건강검진(결핵검진 포함)",
      bands: [
        {
          kind: "do",
          title: "해야 할 일 · 남길 기록",
          groups: [
            {
              heading: "기존 직원",
              items: [
                { text: "결핵검진을 포함한 건강검진을 연 1회 실시한다.", emphasis: [E.tb, E.year] },
                { text: "국민건강보험공단 일반 건강검진 수준으로 5개 영역(계측검사, 요검사, 혈액검사, 영상검사 및 판정)을 충족한다.", emphasis: [E.five] },
                { text: "연 1회 실시 여부가 EDI로 확인되면 별도의 종이기록을 확인하지 않는다. 평가일 현장에서 사업장 EDI 로그인을 준비한다.", emphasis: [E.edi] },
              ],
            },
            {
              heading: "신규 직원",
              items: [
                { text: "근무 시작일까지 건강검진 결과통보서를 제출한다.", emphasis: [E.start] },
                { text: "5개 영역을 충족하는 입사 전 1년 이내 결과만 인정한다.", emphasis: [E.five, E.yearIn] },
                { text: "결과통보서의 검진일·판정일·발행일이 1년 이내인지 확인한다. 판정일 또는 발행일을 확인할 수 없으면 수령(확인) 날짜를 알 수 있는 객관 자료를 둔다.", emphasis: [E.exam, E.judge, E.issue, E.recv] },
                { text: "입사연도에 실시한 결과통보서를 제출하면 해당 연도의 연 1회 건강검진 기준을 충족한 것으로 인정한다. 전년도 자료이면 해당 연도 검진을 따로 확인한다.", emphasis: [E.year] },
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
                { text: "기존 직원은 연 1회. 신규 직원은 근무 시작일까지, 입사 전 1년 이내 결과.", emphasis: [E.year, E.start, E.yearIn] },
                { text: "직원에는 대표자겸 직원(대표자인 시설장 포함), 고용된 시설장도 포함한다." },
                { text: "EDI로 확인되면 종이기록을 보지 않되, 평가일 현장 사업장 EDI 로그인이 필요하다.", emphasis: [E.edi] },
              ],
            },
          ],
        },
      ],
      details: [
        {
          title: "신규 입사자 1년 이내 일자 예시",
          filePage: 32,
          text: "신규입사자(근무시작일 2024.6.4.)의 경우 판정일자는 2023.6.5. ~ 2024.6.4일, 발행일자는 2024.6.4일까지 건강검진 결과통보서 제출 시 인정. 판정일 또는 발행일을 확인할 수 없는 경우 SMS수신일, 이메일 수신일 등 수령 증빙을 보관한다.",
        },
        {
          title: "입사연도 검진이 연간 검진을 충족하는 경우",
          filePage: 32,
          text: "2024.4.에 입사한 신규직원이 제출한 건강검진 결과가 2024.1~4월 자료이면 2024년도 연 1회 건강검진은 별도 자료를 확인하지 않으나, 2023.5~12월 자료이면 2024년도 연 1회 건강검진을 받았는지 확인한다.",
        },
      ],
    },
    {
      mark: "②",
      title: "직무스트레스 해소 프로그램",
      bands: [
        {
          kind: "do",
          title: "해야 할 일 · 남길 기록",
          groups: [
            {
              items: [
                { text: "직무스트레스 해소 프로그램을 연 1회 이상 자체 운영하거나 외부 프로그램에 참여한다.", emphasis: [E.year] },
                { text: "자체 프로그램 운영 기록 또는 외부 프로그램 참여의 객관적 증빙을 남긴다." },
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
                { text: "연 1회 이상. 평가계획 공고월의 다음 달부터 적용한다.", emphasis: [E.year] },
                { text: "대표자겸 직원(대표자인 시설장 포함)은 확인하지 않는다." },
                { text: "참여시간은 직원의 월 기준 근무시간(장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시 제49조)에 해당하지 않는다." },
              ],
            },
          ],
        },
      ],
    },
    {
      mark: "③",
      title: "근골격계 질환 검사",
      bands: [
        {
          kind: "do",
          title: "해야 할 일 · 남길 기록",
          groups: [
            {
              items: [
                { text: "모든 직원의 근골격계 질환 검사를 연 1회 이상 실시한다. 병원검진이나 설문지검사 모두 인정한다.", emphasis: [E.year] },
                { text: "일자, 검사자료, 대상자명을 남긴다." },
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
                { text: "연 1회 이상.", emphasis: [E.year] },
                { text: "대표자겸 직원(대표자인 시설장 포함)은 확인하지 않는다." },
                { text: "설문지는 「근골격계부담작업의 범위 및 유해요인조사 방법에 관한 고시」 별지 제2호 서식 등을 쓰며, 해당 서식 이용 시 검사일자를 별도 기재한다." },
              ],
            },
          ],
        },
      ],
    },
    {
      mark: "④",
      title: "근골격계 증상 조치",
      bands: [
        {
          kind: "do",
          title: "해야 할 일 · 남길 기록",
          groups: [
            {
              items: [
                { text: "검사결과 증상이 있으면 적절한 조치를 한다. 의료 지원, 병원치료, 자체교육(체조, 스트레칭), 체력단련 활동, 급여제공 보조 장비 구비 등을 인정한다." },
                { text: "관련 기록, 지출 영수증 등으로 확인한다." },
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
                { text: "자체교육 강사는 물리(작업)치료사를 원칙으로 하나, 해당 인력이 없으면 다른 직종의 직원이 실시해도 인정한다." },
              ],
            },
          ],
        },
      ],
    },
    {
      mark: "⑤",
      title: "전동침대 구비",
      bands: [
        {
          kind: "do",
          title: "해야 할 일 · 남길 기록",
          groups: [
            {
              items: [{ text: "직원의 근골격계질환 예방을 위하여 전동침대를 구비한다. 평가일 현재 수급자 수와 전동침대 수가 같은지 현장에서 확인한다." }],
            },
          ],
        },
        {
          kind: "when",
          title: "기한·주기 · 꼭 확인할 조건",
          groups: [
            {
              items: [
                { text: "좌식 생활관이 있고, 욕구사정 기록 등으로 좌식생활 수급자·침상에서 스스로 일어나 앉을 수 있는 수급자는 현장 확인 후 전동침대 구비 대상에서 제외하여 산정한다." },
              ],
            },
          ],
        },
      ],
    },
    {
      mark: "⑥",
      title: "목욕·이동 리프트",
      bands: [
        {
          kind: "do",
          title: "해야 할 일 · 남길 기록",
          groups: [
            {
              items: [{ text: "목욕 또는 이동용 리프트를 1개 이상 구비한다.", emphasis: [E.one] }],
            },
          ],
        },
        {
          kind: "deny",
          title: "불인정·주의",
          groups: [
            {
              items: [{ text: "평가 당일 리프트가 작동하지 않는 경우 인정하지 않는다." }],
            },
          ],
        },
      ],
    },
  ],
};

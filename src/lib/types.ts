export type CriteriaItem = { mark: string; text: string };

export type Side = {
  intro: string;
  criteria: string;
  period: string;
  method: string;
  law: string;
  criteriaItems: CriteriaItem[];
  text: string;
};

export type PrevRef = { id: number; name: string; score: number };

export type IndicatorFullSource = import("@/lib/extract/parseIndicators").IndicatorFull;

export type Indicator = {
  id: number;
  name: string;
  area: string;
  sub: string;
  score: number;
  isNew: boolean;
  pages: number[];
  printedPages?: number[];
  prevIndicators: PrevRef[];
  changeNote: string;
  curr: Side;
  prev: Side;
  fullSource?: IndicatorFullSource | null;
  localPreview?: boolean;
};

export type Manual = {
  title: string;
  subtitle: string;
  years: { prev: number; curr: number };
  scoreboard: {
    prev: { indicators: number; domains: string[]; scale: string; period: string };
    curr: {
      indicators: number;
      domains: { name: string; items: number; score: number }[];
      total: number;
      period: string;
    };
  };
  removed2021: { id: number; name: string; score: number }[];
  new2025: { id: number; name: string; score: number; area: string }[];
  indicators: Indicator[];
};

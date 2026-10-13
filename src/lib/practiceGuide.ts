import { indicator5Practice } from "@/data/practiceGuides/indicator-5";
import { indicator28Practice } from "@/data/practiceGuides/indicator-28";

export type PracticeReviewStatus = "draft" | "in-review" | "approved";

export type PracticeQuote = {
  mark?: string;
  quote: string;
  filePage?: number;
};

export type ScoreLine = {
  points: string;
  condition: string;
  jointMarks?: string;
};

export type BandKind = "do" | "when" | "deny" | "detail";

export type BandGroup = {
  heading?: string;
  items: { text: string; emphasis?: string[] }[];
};

export type PracticeBand = {
  kind: BandKind;
  title: string;
  groups: BandGroup[];
};

export type PracticeCard = {
  mark: string;
  title: string;
  bands: PracticeBand[];
  details?: { title: string; text: string; filePage?: number }[];
};

export type PracticeGuide = {
  indicatorId: number;
  kind: "practice";
  title: string;
  status: PracticeReviewStatus;
  approved: boolean;
  aiGenerated: boolean;
  adminReviewHook: "ai-review";
  linkReason: string;
  source: {
    pdfFile: string;
    versionLabel: string;
    pdfSha12: string;
    pageStart: number;
    pageEnd: number;
    quotes: PracticeQuote[];
  };
  cards: PracticeCard[];
};

const GUIDES: Record<number, PracticeGuide> = {
  5: indicator5Practice,
  28: indicator28Practice,
};

export function practiceGuideFor(indicatorId: number): PracticeGuide | null {
  return GUIDES[indicatorId] || null;
}

export function inReviewPracticeGuides(): PracticeGuide[] {
  return Object.values(GUIDES).filter((g) => g.status !== "approved");
}

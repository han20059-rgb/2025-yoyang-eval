export type ExtractStatus = "complete" | "partial" | "failed";
export type BlockKind =
  | "heading"
  | "paragraph"
  | "table"
  | "image"
  | "auto-number"
  | "score"
  | "period"
  | "method"
  | "exception"
  | "law"
  | "other";

export type SourceKind = "original" | "interpretation";

export type TableCell = {
  r: number;
  c: number;
  text: string;
  rowSpan?: number;
  colSpan?: number;
};

export type ExtractedTable = {
  id: string;
  page: number;
  caption?: string;
  cells: TableCell[];
  needsReview: boolean;
  reviewReason?: string;
};

export type ExtractedImage = {
  id: string;
  page: number;
  width?: number;
  height?: number;
  ocrText: string;
  ocrRan: boolean;
  storedRel?: string;
  needsReview: boolean;
  reviewReason: string;
};

export type ExtractedBlock = {
  id: string;
  kind: BlockKind;
  page: number;
  printedPage: number | null;
  loc: { y?: number; x?: number; column?: "left" | "right" | "full" };
  text: string;
  source: SourceKind;
  needsReview: boolean;
  reviewReason?: string;
};

export type PageExtract = {
  page: number;
  printedPage: number | null;
  width: number;
  height: number;
  text: string;
  left: string;
  right: string;
  charCount: number;
  imageCount: number;
  ocrUsed: boolean;
  needsReview: boolean;
  reviewReasons: string[];
  tables: ExtractedTable[];
  images: ExtractedImage[];
};

export type ClassifiedFields = {
  criteria: string;
  scores: string;
  method: string;
  period: string;
  frequency: string;
  deadline: string;
  exceptions: string;
  law: string;
};

export type FileExtractResult = {
  format: "pdf" | "hwp" | "hwpx";
  fileName: string;
  status: ExtractStatus;
  error?: string;
  warnings: string[];
  pageCount: number;
  pages: PageExtract[];
  blocks: ExtractedBlock[];
  tables: ExtractedTable[];
  classified: ClassifiedFields;
  classifiedIsInterpretation: true;
  comparedWithOtherFormat: false | true;
};

export type CrossFormatDiff = {
  page: number | null;
  kind: "missing-in-pdf" | "missing-in-hwp" | "text-mismatch" | "table-mismatch";
  pdfText: string;
  hwpText: string;
  note: string;
};

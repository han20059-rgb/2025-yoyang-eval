"use client";

import { useSearchParams } from "next/navigation";
import { OriginalPdfPane } from "@/components/OriginalPdfPane";

export function OriginalPdfView() {
  const sp = useSearchParams();
  const indicatorId = Number(sp.get("indicator") || "") || 0;
  const fromQ = Math.floor(Number(sp.get("from") || "") || 0);
  const toQ = Math.floor(Number(sp.get("to") || "") || 0);
  const pageQ = Math.max(1, Math.floor(Number(sp.get("page") || "1") || 1));
  const from = fromQ || pageQ;
  const to = toQ || from;
  return (
    <main className="h-screen overflow-hidden bg-stone-800">
      <OriginalPdfPane indicatorId={indicatorId} from={from} to={to} />
    </main>
  );
}

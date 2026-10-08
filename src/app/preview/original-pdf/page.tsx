import { Suspense } from "react";
import { OriginalPdfView } from "@/components/OriginalPdfView";

export default function OriginalPdfPage() {
  return (
    <Suspense fallback={<p className="p-4">원본 PDF를 불러오는 중</p>}>
      <OriginalPdfView />
    </Suspense>
  );
}

import { Suspense } from "react";
import { SearchResults } from "@/components/SearchResults";

export default function SearchPage() {
  return (
    <Suspense fallback={<p className="text-stone-500">검색 중…</p>}>
      <SearchResults />
    </Suspense>
  );
}

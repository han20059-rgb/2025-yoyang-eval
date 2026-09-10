import { Suspense } from "react";
import { SearchResults } from "@/components/SearchResults";
import { loadManual } from "@/lib/manual";

export default async function SearchPage() {
  const data = await loadManual();
  return (
    <Suspense fallback={<p className="text-stone-500">검색 중…</p>}>
      <SearchResults indicators={data.indicators} />
    </Suspense>
  );
}

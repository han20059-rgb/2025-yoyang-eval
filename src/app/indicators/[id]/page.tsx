import { notFound } from "next/navigation";
import { Suspense } from "react";
import { IndicatorView } from "@/components/IndicatorView";
import manual from "@/data/manual.json";
import type { Manual } from "@/lib/types";

const data = manual as Manual;

export function generateStaticParams() {
  return data.indicators.map((i) => ({ id: String(i.id) }));
}

export default async function IndicatorPage({ params }: PageProps<"/indicators/[id]">) {
  const { id } = await params;
  const indicator = data.indicators.find((i) => i.id === Number(id));
  if (!indicator) notFound();

  return (
    <Suspense fallback={<p className="text-stone-500">불러오는 중…</p>}>
      <IndicatorView indicator={indicator} />
    </Suspense>
  );
}

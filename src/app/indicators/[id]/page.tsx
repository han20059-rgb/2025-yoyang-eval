import { notFound } from "next/navigation";
import { Suspense } from "react";
import { IndicatorView } from "@/components/IndicatorView";
import { loadManual } from "@/lib/manual";

export async function generateStaticParams() {
  const data = await loadManual();
  return data.indicators.map((i) => ({ id: String(i.id) }));
}

export default async function IndicatorPage({ params }: PageProps<"/indicators/[id]">) {
  const { id } = await params;
  const data = await loadManual();
  const indicator = data.indicators.find((i) => i.id === Number(id));
  if (!indicator) notFound();

  return (
    <Suspense fallback={<p className="text-stone-500">불러오는 중…</p>}>
      <IndicatorView indicator={indicator} catalog={data.indicators} />
    </Suspense>
  );
}

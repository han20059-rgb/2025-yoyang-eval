import { IndicatorList } from "@/components/IndicatorList";
import { loadManual } from "@/lib/manual";

export default async function IndicatorsPage() {
  const data = await loadManual();
  return <IndicatorList indicators={data.indicators} />;
}

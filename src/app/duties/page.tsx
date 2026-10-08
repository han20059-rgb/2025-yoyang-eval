import { DutyBoard } from "@/components/DutyBoard";
import { loadManual } from "@/lib/manual";

export default async function DutiesPage() {
  const data = await loadManual();
  return <DutyBoard indicators={data.indicators} />;
}

import { AssignmentBoard } from "@/components/AssignmentBoard";
import { loadManual } from "@/lib/manual";

export default async function AdminAssignmentsPage() {
  const data = await loadManual();
  return <AssignmentBoard indicators={data.indicators} />;
}

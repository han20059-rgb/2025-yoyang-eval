"use client";

import { use } from "react";
import Link from "next/link";
import { WorkflowCard } from "@/components/LinkedWorkflows";
import { useWorkflows } from "@/components/WorkflowProvider";

export default function WorkflowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { published } = useWorkflows();
  const item = published.find((w) => w.id === id);
  if (!item) {
    return (
      <div className="space-y-3">
        <Link href="/workflows" className="inline-flex min-h-11 items-center text-(--teal) underline">
          목록
        </Link>
        <p>확정된 연결 업무가 아니거나 아직 적용되지 않았습니다.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <Link href="/workflows" className="inline-flex min-h-11 items-center text-(--teal) underline">
        목록
      </Link>
      <WorkflowCard item={item} names={new Map()} />
    </div>
  );
}

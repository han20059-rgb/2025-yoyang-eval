import { Suspense } from "react";
import { EnterForm } from "@/components/EnterForm";

export default function EnterPage() {
  return (
    <Suspense fallback={<p className="p-4">입장 화면을 불러오는 중</p>}>
      <EnterForm />
    </Suspense>
  );
}

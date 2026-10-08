import { NextResponse } from "next/server";
import { loadWorkflowState, originalFingerprintFromPreview, workflowFilePersistAllowed } from "@/lib/workflows/serverStore";
import { publishedOf } from "@/lib/workflows/engine";
import { previewMeta } from "@/lib/workflows/previewMeta";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (req.headers.get("x-eval-demo") === "1") {
    return NextResponse.json({ error: "시연 모드" }, { status: 403 });
  }
  const meta = await previewMeta();
  const state = await loadWorkflowState(originalFingerprintFromPreview(meta.label, meta.pages), meta.label);
  return NextResponse.json({
    items: publishedOf(state),
    originalLabel: state.originalLabel,
    staleOriginal: state.staleOriginal,
    storage: workflowFilePersistAllowed() ? "local-file" : "blocked",
    note: workflowFilePersistAllowed()
      ? "운영 DB가 아닙니다. 확정된 연결만 포함합니다."
      : "저장 미지원 · 배포에서는 확정 연결을 저장하지 않습니다. 시연은 메모리만 사용하세요.",
    persistNote: workflowFilePersistAllowed()
      ? "운영 DB가 아닙니다. 확정된 연결만 포함합니다."
      : "저장 미지원 · 배포에서는 확정 연결을 저장하지 않습니다. 시연은 메모리만 사용하세요.",
  });
}

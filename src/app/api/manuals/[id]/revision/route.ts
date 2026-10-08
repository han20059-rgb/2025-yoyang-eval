import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { compareRevisions, previewCheckUpdates } from "@/lib/extract/compare";
import { getEdition, saveCheckArchive, saveRevisionPreview } from "@/lib/manualStore";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  const { id } = await ctx.params;
  const body = (await req.json()) as { againstId?: string; localCheckKeys?: string[]; apply?: boolean; rollback?: boolean; checks?: Record<string, boolean> };
  const edition = await getEdition(id);
  if (body.rollback) {
    return NextResponse.json({
      ok: true,
      action: "rollback",
      note: "브라우저에 보관한 이전 체크 스냅샷으로 되돌리세요. 확정 매뉴얼 파일은 바꾸지 않았습니다.",
    });
  }
  const against = body.againstId ? await getEdition(body.againstId) : edition?.parentId ? await getEdition(edition.parentId) : null;
  if (!edition || !against) {
    return NextResponse.json({ error: "비교할 이전 등록본이 없습니다." }, { status: 400 });
  }
  const sameYear = edition.evalYear != null && against.evalYear != null && edition.evalYear === against.evalYear;
  const nextText = [edition.extracts.pdf?.pages.map((p) => p.text).join("\n"), edition.extracts.hwp?.pages.map((p) => p.text).join("\n")]
    .filter(Boolean)
    .join("\n");
  const prevText = [against.extracts.pdf?.pages.map((p) => p.text).join("\n"), against.extracts.hwp?.pages.map((p) => p.text).join("\n")]
    .filter(Boolean)
    .join("\n");
  if (!nextText || !prevText) {
    return NextResponse.json({ error: "양쪽 추출 결과가 있어야 개정 비교를 합니다." }, { status: 400 });
  }
  const changes = compareRevisions(prevText, nextText);
  const checkPreview = previewCheckUpdates(changes, body.localCheckKeys || []);
  const saved = await saveRevisionPreview(id, against.id, changes, checkPreview);
  if (body.apply) {
    await saveCheckArchive(id, {
      at: new Date().toISOString(),
      checks: body.checks || {},
      recheck: checkPreview.recheck,
      keep: checkPreview.keep,
    });
    return NextResponse.json({
      edition: saved,
      applied: true,
      exposeToStaff: false,
      comparisonKind: sameYear ? "same-year-revision" : "cross-year",
      checkPreview,
      note: "재확인 필요 표시만 준비했습니다. 기존 체크 값은 지우지 않았고, 직원 확정 매뉴얼은 바꾸지 않았습니다.",
    });
  }
  return NextResponse.json({
    edition: saved,
    comparisonKind: sameYear ? "same-year-revision" : "cross-year",
    note: sameYear
      ? "같은 평가연도 안 개정본 비교입니다."
      : "평가연도 간 비교입니다. 같은 연도 개정본 비교와 구분했습니다.",
    changes,
    checkPreview,
    checkNote: "변경되지 않은 준비 체크는 유지하고, 변경된 기준은 기존 기록을 보존한 채 재확인 필요로만 표시하는 미리보기입니다. 직원 화면에는 아직 반영하지 않습니다.",
  });
}

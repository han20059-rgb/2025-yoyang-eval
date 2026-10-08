import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getEdition, setStatus } from "@/lib/manualStore";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  const { id } = await ctx.params;
  const edition = await getEdition(id);
  if (!edition) return NextResponse.json({ error: "없습니다." }, { status: 404 });
  return NextResponse.json({ edition });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  const { id } = await ctx.params;
  const body = (await req.json()) as { action?: string };
  const edition = await getEdition(id);
  if (!edition) return NextResponse.json({ error: "없습니다." }, { status: 404 });
  if (body.action === "approve") {
    const next = await setStatus(id, "approved_pending_expose", false);
    return NextResponse.json({
      edition: next,
      note: "관리자 승인만 했습니다. 직원 화면의 기존 매뉴얼은 그대로입니다.",
    });
  }
  if (body.action === "rollback") {
    const next = await setStatus(id, "rolled_back", false);
    return NextResponse.json({ edition: next, note: "이 등록본을 직원 화면에 쓰지 않도록 되돌렸습니다." });
  }
  if (body.action === "expose") {
    return NextResponse.json(
      {
        error: "직원 화면 확정 노출은 별도 지시 없이 실행하지 않습니다. 기존 매뉴얼을 덮어쓰지 않았습니다.",
      },
      { status: 409 }
    );
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

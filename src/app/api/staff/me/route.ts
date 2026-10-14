import { NextResponse } from "next/server";
import { isStaffAdmin } from "@/lib/adminAuth";
import { requireStaff } from "@/lib/staffSession";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const gate = await requireStaff(req);
    if (!gate.ok) return gate.res;
    const admin = await isStaffAdmin(gate.token, gate.identity.leaveRecordId);
    return NextResponse.json({
      ok: true,
      identity: { ...gate.identity, isAdmin: admin.admin },
    });
  } catch {
    return NextResponse.json({ error: "로그인 정보를 확인하지 못했습니다. 다시 시도해 주세요." }, { status: 503 });
  }
}

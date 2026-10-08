import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { clearStaffCookie } from "@/lib/staffSession";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (req.headers.get("x-eval-demo") === "1") {
    return NextResponse.json({ admin: false, error: "시연 모드에서는 관리 기능을 쓰지 않습니다." });
  }
  const gate = await requireAdmin(req);
  if (!gate.ok) {
    const status = gate.res.status;
    const body = await gate.res.json().catch(() => ({}));
    return NextResponse.json({ admin: false, error: body.error }, { status: status === 401 ? 200 : status });
  }
  return NextResponse.json({
    admin: true,
    via: gate.via,
    identity: { leaveRecordId: gate.identity.leaveRecordId, name: gate.identity.name, jobType: gate.identity.jobType },
  });
}

export async function POST() {
  return NextResponse.json(
    { error: "관리 키 로그인은 제거했습니다. 상단에서 생년월일 6자리와 기존 비밀번호로 직원 로그인을 해 주세요." },
    { status: 400 }
  );
}

export async function DELETE() {
  const res = NextResponse.json({ admin: false });
  res.headers.set("Set-Cookie", clearStaffCookie());
  return res;
}

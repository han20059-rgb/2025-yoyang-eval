import { NextResponse } from "next/server";
import { isStaffAdmin } from "@/lib/adminAuth";
import { loginStaff, staffCookieHeader } from "@/lib/staffSession";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (req.headers.get("x-eval-demo") === "1") {
    return NextResponse.json({ error: "시연 모드에서는 실제 로그인하지 않습니다." }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { yymmdd?: string; password?: string; remember?: boolean };
  const yymmdd = String(body.yymmdd || "").replace(/\D/g, "").slice(0, 6);
  const password = String(body.password || "");
  if (!/^\d{6}$/.test(yymmdd) || !password) {
    return NextResponse.json({ error: "생년월일 6자리와 비밀번호를 입력해 주세요." }, { status: 400 });
  }
  const result = await loginStaff(yymmdd, password, !!body.remember);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 });
  const admin = await isStaffAdmin(result.identity.leaveRecordId);
  const res = NextResponse.json({
    ok: true,
    identity: { ...result.identity, isAdmin: admin.admin },
  });
  res.headers.set("Set-Cookie", staffCookieHeader(result.token, result.remember));
  return res;
}

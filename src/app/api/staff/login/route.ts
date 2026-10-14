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
  try {
    const result = await loginStaff(yymmdd, password, !!body.remember);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 });
    const admin = await isStaffAdmin(result.token, result.identity.leaveRecordId);
    const res = NextResponse.json({
      ok: true,
      identity: { ...result.identity, isAdmin: admin.admin },
    });
    const remember = "remember" in result ? Boolean(result.remember) : !!body.remember;
    res.headers.set("Set-Cookie", staffCookieHeader(result.token, remember));
    return res;
  } catch {
    return NextResponse.json({ error: "로그인 처리 중 오류가 났습니다. 다시 시도해 주세요." }, { status: 503 });
  }
}

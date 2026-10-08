import { NextResponse } from "next/server";
import { siteAccessPassword, siteGateCookieHeader, siteGateEnabled, siteGateToken } from "@/lib/siteGate";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!siteGateEnabled()) {
    return NextResponse.json({ ok: true, gated: false });
  }
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const secret = siteAccessPassword();
  if (!body.password || body.password !== secret) {
    return NextResponse.json({ error: "비밀번호가 다릅니다." }, { status: 401 });
  }
  const token = siteGateToken(secret);
  return NextResponse.json(
    { ok: true, gated: true },
    { headers: { "Set-Cookie": siteGateCookieHeader(token) } }
  );
}

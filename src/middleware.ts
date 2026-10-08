import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE = "eval_site_gate";

async function expectedToken(secret: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const buf = await crypto.subtle.sign("HMAC", key, enc.encode("eval-site-ok"));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function middleware(req: NextRequest) {
  const secret = (process.env.SITE_ACCESS_PASSWORD || "").trim();
  if (!secret) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (
    pathname === "/enter" ||
    pathname.startsWith("/api/site-gate") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/pdf.worker.min.mjs"
  ) {
    return NextResponse.next();
  }
  const got = req.cookies.get(COOKIE)?.value || "";
  const want = await expectedToken(secret);
  if (got && got === want) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "사이트 입장이 필요합니다." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/enter";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

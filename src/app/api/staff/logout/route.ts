import { NextResponse } from "next/server";
import { clearStaffCookie } from "@/lib/staffSession";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", clearStaffCookie());
  return res;
}

import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { localIdentity, localLogin } from "@/lib/evalLocalDb";
import { evalAnon } from "@/lib/evalSb";
import { mapJobType } from "@/lib/jobMap";
import type { StaffIdentity } from "@/lib/staffTypes";

const COOKIE = "eval_staff_token";

export type { StaffIdentity } from "@/lib/staffTypes";

function sb() {
  return evalAnon();
}

export function staffCookieHeader(token: string, remember: boolean) {
  const max = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 12;
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${max}`;
}

export function clearStaffCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function demoBlocked(req: Request) {
  return req.headers.get("x-eval-demo") === "1";
}

export function cookieToken(req: Request) {
  const raw = req.headers.get("cookie") || "";
  const m = raw.match(/(?:^|;\s*)eval_staff_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

export async function loginStaff(yymmdd: string, pw: string, remember: boolean) {
  const local = await localLogin(yymmdd, pw);
  if (local) {
    if (!local.ok) return local;
    return { ok: true as const, token: local.token, remember: !!remember, identity: local.identity };
  }
  const client = sb();
  if (!client) return { ok: false as const, error: "직원 인증 서버에 연결할 수 없습니다." };
  const { data, error } = await client.rpc("leave_staff_login", { yymmdd, pw, remember });
  if (error) return { ok: false as const, error: "직원 인증을 호출하지 못했습니다." };
  const row = data as { ok?: boolean; error?: string; token?: string; mustChange?: boolean; remember?: boolean };
  if (!row?.ok || !row.token) return { ok: false as const, error: row?.error || "로그인에 실패했습니다." };
  if (row.mustChange) {
    return { ok: false as const, error: "먼저 지원부서에서 비밀번호를 바꿔 주세요." };
  }
  const me = await identityFromToken(row.token);
  if (!me.ok) return me;
  return { ok: true as const, token: row.token, remember: !!remember, identity: me.identity };
}

export async function identityFromToken(token: string): Promise<{ ok: true; identity: StaffIdentity } | { ok: false; error: string }> {
  const local = await localIdentity(token);
  if (local) return local;
  const client = sb();
  if (!client) return { ok: false, error: "직원 인증 서버에 연결할 수 없습니다." };
  const { data, error } = await client.rpc("leave_staff_me", { token });
  if (error) return { ok: false, error: "로그인 정보를 확인하지 못했습니다." };
  const row = data as { ok?: boolean; error?: string; leaveRecordId?: number; records?: Record<string, { jobType?: string }> };
  if (!row?.ok || !row.records) return { ok: false, error: row?.error || "로그인이 만료되었습니다." };
  const names = Object.keys(row.records);
  if (names.length !== 1) {
    return { ok: false, error: "계정을 하나로 식별하지 못했습니다. 다른 직원을 고르지 않습니다." };
  }
  const name = names[0];
  const jobType = String(row.records[name]?.jobType || "");
  const mapped = mapJobType(jobType);
  const leaveRecordId = Number(row.leaveRecordId || 0);
  return {
    ok: true,
    identity: {
      leaveRecordId,
      name,
      jobType,
      evalRole: mapped.role,
      roleStatus: mapped.status,
      roleNote: mapped.note,
      isAdmin: false,
    },
  };
}

export async function requireStaff(req: Request) {
  if (demoBlocked(req)) {
    return { ok: false as const, res: NextResponse.json({ error: "시연 모드에서는 실제 저장을 할 수 없습니다." }, { status: 403 }) };
  }
  const token = cookieToken(req);
  if (!token) {
    return { ok: false as const, res: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  }
  const me = await identityFromToken(token);
  if (!me.ok) return { ok: false as const, res: NextResponse.json({ error: me.error }, { status: 401 }) };
  return { ok: true as const, identity: me.identity, token };
}

export function actorHash(leaveRecordId: number) {
  return createHash("sha256").update(`eval-actor:${leaveRecordId}`).digest("hex").slice(0, 16);
}

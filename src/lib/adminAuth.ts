import { NextResponse } from "next/server";
import { localDbUrl, localServiceQuery } from "@/lib/evalLocalDb";
import { evalAnon, evalService } from "@/lib/evalSb";
import { demoBlocked, requireStaff, type StaffIdentity } from "@/lib/staffSession";

export type AdminOk = { ok: true; via: "staff-admin"; identity: StaffIdentity };

function deny(message = "관리자만 할 수 있습니다.", status = 403) {
  return { ok: false as const, res: NextResponse.json({ error: message }, { status }) };
}

export async function isStaffAdmin(token: string, leaveRecordId?: number): Promise<{ admin: boolean; storage: "supabase" | "unready" }> {
  if (localDbUrl() && leaveRecordId) {
    const r = await localServiceQuery("select leave_record_id from eval_admins where leave_record_id=$1 and active=true", [leaveRecordId]);
    if (r && r.rows.length > 0) return { admin: true, storage: "supabase" };
  }
  if (!token) return { admin: false, storage: "unready" };
  const sb = evalService() || evalAnon();
  if (!sb) return { admin: false, storage: "unready" };
  try {
    const rpc = (await Promise.race([
      sb.rpc("eval_staff_is_admin", { token }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("admin-rpc-timeout")), 15000)),
    ])) as { data: unknown; error: { message?: string } | null };
    if (rpc.error) return { admin: false, storage: "unready" };
    const row = rpc.data as { ok?: boolean; admin?: boolean } | null;
    if (!row || row.ok !== true || typeof row.admin !== "boolean") return { admin: false, storage: "unready" };
    return { admin: row.admin, storage: "supabase" };
  } catch {
    return { admin: false, storage: "unready" };
  }
}

export async function requireAdmin(req: Request): Promise<AdminOk | { ok: false; res: NextResponse }> {
  if (demoBlocked(req) || req.headers.get("x-eval-demo") === "1") {
    return deny("시연 모드에서는 관리 기능을 쓰지 않습니다.");
  }
  const staff = await requireStaff(req);
  if (!staff.ok) return staff;
  const gate = await isStaffAdmin(staff.token, staff.identity.leaveRecordId);
  if (gate.storage === "unready") {
    return deny("관리자 권한 저장소가 아직 없습니다.", 503);
  }
  if (!gate.admin) {
    return deny("관리자 권한이 없는 직원입니다.");
  }
  return { ok: true, via: "staff-admin", identity: { ...staff.identity, isAdmin: true } };
}

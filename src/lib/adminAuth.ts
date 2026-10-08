import { NextResponse } from "next/server";
import { localDbUrl, localServiceQuery } from "@/lib/evalLocalDb";
import { evalAnon, evalService } from "@/lib/evalSb";
import { demoBlocked, requireStaff, type StaffIdentity } from "@/lib/staffSession";

export type AdminOk = { ok: true; via: "staff-admin"; identity: StaffIdentity };

function deny(message = "관리자만 할 수 있습니다.", status = 403) {
  return { ok: false as const, res: NextResponse.json({ error: message }, { status }) };
}

export async function isStaffAdmin(leaveRecordId: number): Promise<{ admin: boolean; storage: "supabase" | "unready" }> {
  if (!leaveRecordId) return { admin: false, storage: "unready" };
  if (localDbUrl()) {
    const r = await localServiceQuery("select leave_record_id from eval_admins where leave_record_id=$1 and active=true", [leaveRecordId]);
    if (!r) return { admin: false, storage: "unready" };
    return { admin: r.rows.length > 0, storage: "supabase" };
  }
  const sb = evalService() || evalAnon();
  if (!sb) return { admin: false, storage: "unready" };
  const { data, error } = await sb.rpc("eval_is_staff_admin", { p_leave_record_id: leaveRecordId });
  if (error) {
    const table = await sb.from("eval_admins").select("leave_record_id").eq("leave_record_id", leaveRecordId).eq("active", true).maybeSingle();
    if (table.error) return { admin: false, storage: "unready" };
    return { admin: Boolean(table.data?.leave_record_id), storage: "supabase" };
  }
  return { admin: Boolean(data), storage: "supabase" };
}

export async function requireAdmin(req: Request): Promise<AdminOk | { ok: false; res: NextResponse }> {
  if (demoBlocked(req) || req.headers.get("x-eval-demo") === "1") {
    return deny("시연 모드에서는 관리 기능을 쓰지 않습니다.");
  }
  const staff = await requireStaff(req);
  if (!staff.ok) return staff;
  const gate = await isStaffAdmin(staff.identity.leaveRecordId);
  if (gate.storage === "unready") {
    return deny("관리자 권한 저장소가 아직 없습니다.", 503);
  }
  if (!gate.admin) {
    return deny("관리자 권한이 없는 직원입니다.");
  }
  return { ok: true, via: "staff-admin", identity: { ...staff.identity, isAdmin: true } };
}

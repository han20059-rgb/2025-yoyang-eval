import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { cookieToken } from "@/lib/staffSession";
import { localDbUrl, localServiceQuery } from "@/lib/evalLocalDb";
import { evalAnon, evalService } from "@/lib/evalSb";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (req.headers.get("x-eval-demo") === "1") {
    return NextResponse.json({ error: "시연 모드" }, { status: 403 });
  }
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  if (localDbUrl()) {
    const r = await localServiceQuery("select leave_record_id, name_snapshot, granted_by_leave_record_id, granted_at, active from eval_admins order by leave_record_id");
    const ev = await localServiceQuery("select target_leave_record_id as \"targetLeaveRecordId\", actor_leave_record_id as \"actorLeaveRecordId\", action, note, created_at as \"createdAt\" from eval_admin_events order by created_at desc limit 50");
    if (!r) return NextResponse.json({ error: "관리자 목록을 읽지 못했습니다.", storage: "unready" }, { status: 503 });
    return NextResponse.json({ items: r.rows, events: ev?.rows || [], storage: "supabase" });
  }
  const token = cookieToken(req);
  const rpc = evalAnon();
  const svc = evalService();
  if (rpc && token) {
    const listed = await rpc.rpc("eval_list_admins", { token });
    const events = await rpc.rpc("eval_list_admin_events", { token });
    if (!listed.error) {
      return NextResponse.json({
        items: listed.data || [],
        events: events.error ? [] : events.data || [],
        storage: "supabase",
      });
    }
  }
  if (!svc) return NextResponse.json({ error: "권한 저장소가 없습니다.", storage: "unready" }, { status: 503 });
  const { data, error } = await svc.from("eval_admins").select("leave_record_id, name_snapshot, granted_by_leave_record_id, granted_at, active").order("leave_record_id");
  if (error) return NextResponse.json({ error: "관리자 목록을 읽지 못했습니다.", detail: error.message }, { status: 503 });
  return NextResponse.json({ items: data || [], storage: "supabase" });
}

export async function POST(req: Request) {
  if (req.headers.get("x-eval-demo") === "1") {
    return NextResponse.json({ error: "시연 모드에서는 권한을 바꾸지 않습니다." }, { status: 403 });
  }
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  const body = (await req.json()) as { leaveRecordId?: number; nameSnapshot?: string; action?: "grant" | "revoke" };
  const target = Number(body.leaveRecordId || 0);
  if (!target) return NextResponse.json({ error: "직원 고유 ID가 필요합니다. 이름만으로는 권한을 주지 않습니다." }, { status: 400 });
  const action = body.action === "revoke" ? "revoke" : "grant";
  if (localDbUrl()) {
    const exists = await localServiceQuery("select leave_record_id, name from eval_local_staff where leave_record_id=$1", [target]);
    if (!exists?.rows[0]) {
      return NextResponse.json({ error: "재직 중인 직원 고유 ID만 권한을 줄 수 있습니다." }, { status: 400 });
    }
    if (action === "revoke") {
      const up = await localServiceQuery(
        `with locked as (select leave_record_id from eval_admins where active=true for update),
              counted as (select count(*)::int as n from locked)
         update eval_admins e set active=false
         from counted
         where e.leave_record_id=$1 and e.active=true and counted.n > 1
         returning e.leave_record_id`,
        [target]
      );
      if (!up?.rows[0]) {
        return NextResponse.json({ error: "마지막 관리자 권한은 해제할 수 없습니다." }, { status: 400 });
      }
    } else {
      await localServiceQuery(
        `insert into eval_admins(leave_record_id, name_snapshot, granted_by_leave_record_id, granted_at, active)
         values ($1,$2,$3,now(),true)
         on conflict (leave_record_id) do update set active=true, name_snapshot=excluded.name_snapshot, granted_by_leave_record_id=excluded.granted_by_leave_record_id, granted_at=now()`,
        [target, String(body.nameSnapshot || exists.rows[0].name || "").slice(0, 80), gate.identity.leaveRecordId]
      );
    }
    await localServiceQuery(
      "insert into eval_admin_events(target_leave_record_id, actor_leave_record_id, action, note) values ($1,$2,$3,$4)",
      [target, gate.identity.leaveRecordId, action, action === "grant" ? "관리자 부여" : "관리자 해제"]
    );
    return NextResponse.json({ ok: true, saved: true });
  }
  const token = cookieToken(req);
  const rpc = evalAnon();
  const svc = evalService();
  if (rpc && token) {
    const { error } = await rpc.rpc("eval_set_admin", {
      token,
      p_leave_record_id: target,
      p_name_snapshot: String(body.nameSnapshot || "").slice(0, 80),
      p_action: action,
    });
    if (!error) return NextResponse.json({ ok: true, saved: true });
    if (error.message.includes("last_admin")) {
      return NextResponse.json({ error: "마지막 관리자 권한은 해제할 수 없습니다." }, { status: 400 });
    }
    if (error.message.includes("invalid_target")) {
      return NextResponse.json({ error: "재직 중인 직원 고유 ID만 권한을 줄 수 있습니다." }, { status: 400 });
    }
    if (!svc) return NextResponse.json({ error: "저장 실패. 권한 테이블이 없습니다.", detail: error.message }, { status: 503 });
  }
  if (!svc) return NextResponse.json({ error: "저장 실패. 권한 테이블이 없습니다.", storage: "unready" }, { status: 503 });
  if (action === "revoke") {
    const { count } = await svc.from("eval_admins").select("leave_record_id", { count: "exact", head: true }).eq("active", true);
    if ((count || 0) <= 1) {
      return NextResponse.json({ error: "마지막 관리자 권한은 해제할 수 없습니다." }, { status: 400 });
    }
    const { error } = await svc.from("eval_admins").update({ active: false }).eq("leave_record_id", target);
    if (error) return NextResponse.json({ error: "해제에 실패했습니다.", detail: error.message }, { status: 503 });
  } else {
    const { error } = await svc.from("eval_admins").upsert({
      leave_record_id: target,
      name_snapshot: String(body.nameSnapshot || "").slice(0, 80),
      granted_by_leave_record_id: gate.identity.leaveRecordId,
      granted_at: new Date().toISOString(),
      active: true,
    });
    if (error) return NextResponse.json({ error: "부여에 실패했습니다.", detail: error.message }, { status: 503 });
  }
  await svc.from("eval_admin_events").insert({
    target_leave_record_id: target,
    actor_leave_record_id: gate.identity.leaveRecordId,
    action,
    note: action === "grant" ? "관리자 부여" : "관리자 해제",
  });
  return NextResponse.json({ ok: true, saved: true });
}

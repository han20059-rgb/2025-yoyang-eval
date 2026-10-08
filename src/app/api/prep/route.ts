import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { cookieToken, requireStaff } from "@/lib/staffSession";
import { localDbUrl, localServiceQuery } from "@/lib/evalLocalDb";
import { evalAnon, evalService } from "@/lib/evalSb";
import type { RoleId } from "@/data/duties";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (req.headers.get("x-eval-demo") === "1") {
    return NextResponse.json({ error: "시연 모드" }, { status: 403 });
  }
  const admin = await requireAdmin(req);
  const staff = admin.ok ? null : await requireStaff(req);
  if (!admin.ok && !staff?.ok) {
    return staff?.res ?? NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (localDbUrl()) {
    const checks = await localServiceQuery("select indicator_id, mark, role, done, updated_at, updated_by_name from eval_org_checks");
    const events = await localServiceQuery("select indicator_id, mark, role, action, actor_name, as_admin, created_at from eval_org_check_events order by created_at desc limit 200");
    if (!checks || !events) return NextResponse.json({ error: "기관 현황을 읽지 못했습니다.", storage: "unready" }, { status: 503 });
    return NextResponse.json({ checks: checks.rows, events: events.rows });
  }
  const token = cookieToken(req);
  const rpc = evalAnon();
  const svc = evalService();
  if (rpc && token) {
    const { data, error } = await rpc.rpc("eval_list_org_checks", { token });
    if (!error) {
      const payload = (data || {}) as { checks?: unknown[]; events?: unknown[] };
      return NextResponse.json({ checks: payload.checks || [], events: payload.events || [] });
    }
  }
  if (!svc) {
    return NextResponse.json({ error: "기관 현황 저장소가 아직 준비되지 않았습니다. 운영 마이그레이션 전입니다.", storage: "unready" }, { status: 503 });
  }
  const { data, error } = await svc.from("eval_org_checks").select("indicator_id, mark, role, done, updated_at, updated_by_name");
  if (error) {
    return NextResponse.json({ error: "기관 현황을 읽지 못했습니다. 로컬로 대체하지 않습니다.", detail: error.message }, { status: 503 });
  }
  const { data: events } = await svc.from("eval_org_check_events").select("indicator_id, mark, role, action, actor_name, as_admin, created_at").order("created_at", { ascending: false }).limit(200);
  return NextResponse.json({ checks: data || [], events: events || [] });
}

export async function POST(req: Request) {
  if (req.headers.get("x-eval-demo") === "1") {
    return NextResponse.json({ error: "시연 모드에서는 실제 저장을 하지 않습니다." }, { status: 403 });
  }
  const body = (await req.json()) as { indicatorId: number; mark: string; role: RoleId; done: boolean };
  const admin = await requireAdmin(req);
  const staff = admin.ok ? null : await requireStaff(req);
  if (!admin.ok && !staff?.ok) {
    return staff?.res ?? NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const actorName = admin.ok ? admin.identity.name : staff?.ok ? staff.identity.name : "";
  const actorId = admin.ok ? admin.identity.leaveRecordId : staff?.ok ? staff.identity.leaveRecordId : null;
  const actorRole = staff?.ok ? staff.identity.evalRole : null;
  if (!admin.ok) {
    if (!actorRole || actorRole !== body.role) {
      return NextResponse.json({ error: "본인 평가 직종의 항목만 바꿀 수 있습니다." }, { status: 403 });
    }
  }
  if (localDbUrl()) {
    await localServiceQuery(
      `insert into eval_org_checks(indicator_id, mark, role, done, updated_at, updated_by_leave_record_id, updated_by_name)
       values ($1,$2,$3,$4,now(),$5,$6)
       on conflict (indicator_id, mark, role) do update set done=excluded.done, updated_at=now(), updated_by_leave_record_id=excluded.updated_by_leave_record_id, updated_by_name=excluded.updated_by_name`,
      [body.indicatorId, body.mark, body.role, body.done, actorId, actorName]
    );
    await localServiceQuery(
      "insert into eval_org_check_events(indicator_id, mark, role, action, actor_leave_record_id, actor_name, as_admin) values ($1,$2,$3,$4,$5,$6,$7)",
      [body.indicatorId, body.mark, body.role, body.done ? "complete" : "cancel", actorId, actorName, admin.ok]
    );
    return NextResponse.json({ ok: true, saved: true });
  }
  const token = cookieToken(req);
  const rpc = evalAnon();
  const svc = evalService();
  if (rpc && token) {
    const { error } = await rpc.rpc("eval_save_org_check", {
      token,
      p_indicator_id: body.indicatorId,
      p_mark: body.mark,
      p_role: body.role,
      p_done: body.done,
    });
    if (!error) return NextResponse.json({ ok: true, saved: true });
    if (!svc) {
      return NextResponse.json({ error: "저장 실패. 로컬로 대신 저장하지 않습니다.", detail: error.message }, { status: 503 });
    }
  }
  if (!svc) {
    return NextResponse.json({ error: "저장 실패. 기관 현황 테이블이 아직 없습니다.", storage: "unready" }, { status: 503 });
  }
  const { error } = await svc.from("eval_org_checks").upsert({
    indicator_id: body.indicatorId,
    mark: body.mark,
    role: body.role,
    done: body.done,
    updated_at: new Date().toISOString(),
    updated_by_leave_record_id: actorId,
    updated_by_name: actorName,
  });
  if (error) {
    return NextResponse.json({ error: "저장 실패. 로컬로 대신 저장하지 않습니다.", detail: error.message }, { status: 503 });
  }
  await svc.from("eval_org_check_events").insert({
    indicator_id: body.indicatorId,
    mark: body.mark,
    role: body.role,
    action: body.done ? "complete" : "cancel",
    actor_leave_record_id: actorId,
    actor_name: actorName,
    as_admin: admin.ok,
  });
  return NextResponse.json({ ok: true, saved: true });
}

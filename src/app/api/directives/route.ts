import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { cookieToken, requireStaff } from "@/lib/staffSession";
import { asRole } from "@/lib/assignmentMerge";
import { directiveVisible, type EvalDirective, type DirectiveNote } from "@/lib/directives";
import { localDbUrl, localServiceQuery } from "@/lib/evalLocalDb";
import { evalAnon, evalService } from "@/lib/evalSb";
import type { RoleId } from "@/data/duties";

export const runtime = "nodejs";

function mapRow(row: Record<string, unknown>): EvalDirective {
  return {
    id: String(row.id),
    indicatorId: Number(row.indicator_id),
    mark: String(row.mark),
    targetRoles: ((row.target_roles as string[]) || []).map((x) => asRole(x)).filter(Boolean) as RoleId[],
    targetStaffIds: ((row.target_staff_ids as number[]) || []).map(Number).filter(Boolean),
    targetStaffNames: (row.target_staff_names as string[]) || [],
    body: String(row.body || ""),
    due: row.due_on ? String(row.due_on).slice(0, 10) : "",
    authorName: String(row.author_name || ""),
    authorId: Number(row.author_leave_record_id || 0),
    createdAt: String(row.created_at || ""),
    status: (["open", "doing", "done"].includes(String(row.status)) ? String(row.status) : "open") as EvalDirective["status"],
    notes: Array.isArray(row.notes) ? (row.notes as DirectiveNote[]) : [],
  };
}

export async function GET(req: Request) {
  if (req.headers.get("x-eval-demo") === "1") {
    return NextResponse.json({ error: "시연 모드에서는 실제 지시를 읽지 않습니다." }, { status: 403 });
  }
  const admin = await requireAdmin(req);
  const staff = admin.ok ? null : await requireStaff(req);
  if (!admin.ok && !staff?.ok) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const identity = admin.ok ? admin.identity : staff && staff.ok ? staff.identity : null;
  if (!identity) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (localDbUrl()) {
    const r = await localServiceQuery(
      "select id, indicator_id, mark, target_roles, target_staff_ids, target_staff_names, body, due_on, status, author_name, author_leave_record_id, notes, created_at from eval_directives order by created_at desc"
    );
    if (!r) return NextResponse.json({ items: [], storage: "unready" }, { status: 503 });
    const items = r.rows.map((row) => mapRow(row as Record<string, unknown>)).filter((d) =>
      directiveVisible(d, identity.evalRole, identity.leaveRecordId, admin.ok)
    );
    return NextResponse.json({ items, storage: "supabase" });
  }
  const token = cookieToken(req);
  const rpc = evalAnon();
  if (rpc && token) {
    const { data, error } = await rpc.rpc("eval_list_directives", { token });
    if (!error) {
      const raw = Array.isArray(data) ? data : [];
      return NextResponse.json({ items: raw.map((row) => mapRow(row as Record<string, unknown>)), storage: "supabase" });
    }
  }
  const svc = evalService();
  if (!svc) return NextResponse.json({ items: [], storage: "unready" }, { status: 503 });
  const { data, error } = await svc.from("eval_directives").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message, items: [], storage: "unready" }, { status: 503 });
  const items = (data || []).map((row) => mapRow(row as Record<string, unknown>)).filter((d) =>
    directiveVisible(d, identity.evalRole, identity.leaveRecordId, admin.ok)
  );
  return NextResponse.json({ items, storage: "supabase" });
}

export async function POST(req: Request) {
  if (req.headers.get("x-eval-demo") === "1") {
    return NextResponse.json({ error: "시연 모드에서는 지시를 저장하지 않습니다." }, { status: 403 });
  }
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  const body = await req.json().catch(() => ({}));
  const indicatorId = Number(body.indicatorId);
  const mark = String(body.mark || "");
  const targetRoles = [...new Set(((body.targetRoles || []) as string[]).map((r) => asRole(r)).filter(Boolean))] as RoleId[];
  const targetStaffIds = ((body.targetStaffIds || []) as number[]).map(Number).filter(Boolean);
  const targetStaffNames = ((body.targetStaffNames || []) as string[]).map(String).filter(Boolean);
  const text = String(body.body || "").trim();
  const due = String(body.due || "").slice(0, 10) || null;
  if (!indicatorId || !mark || !text) {
    return NextResponse.json({ error: "지시 내용과 기준이 필요합니다." }, { status: 400 });
  }
  if (!targetRoles.length && !targetStaffIds.length) {
    return NextResponse.json({ error: "지시 대상 직종 또는 직원이 필요합니다." }, { status: 400 });
  }
  const actorName = gate.identity.name;
  const actorId = gate.identity.leaveRecordId;
  if (localDbUrl()) {
    const up = await localServiceQuery(
      `insert into eval_directives(indicator_id, mark, target_roles, target_staff_ids, target_staff_names, body, due_on, author_name, author_leave_record_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [indicatorId, mark, targetRoles, targetStaffIds, targetStaffNames, text, due, actorName, actorId]
    );
    if (!up) return NextResponse.json({ error: "저장 실패", storage: "unready" }, { status: 503 });
    return NextResponse.json({ ok: true, id: up.rows[0]?.id });
  }
  const token = cookieToken(req);
  const rpc = evalAnon();
  if (rpc && token) {
    const { data, error } = await rpc.rpc("eval_create_directive", {
      token,
      p_indicator_id: indicatorId,
      p_mark: mark,
      p_target_roles: targetRoles,
      p_target_staff_ids: targetStaffIds,
      p_target_staff_names: targetStaffNames,
      p_body: text,
      p_due: due,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 503 });
    return NextResponse.json({ ok: true, ...(data as object) });
  }
  const svc = evalService();
  if (!svc) return NextResponse.json({ error: "저장 실패. 지시 테이블이 아직 없습니다.", storage: "unready" }, { status: 503 });
  const { data, error } = await svc.from("eval_directives").insert({
    indicator_id: indicatorId,
    mark,
    target_roles: targetRoles,
    target_staff_ids: targetStaffIds,
    target_staff_names: targetStaffNames,
    body: text,
    due_on: due,
    author_name: actorName,
    author_leave_record_id: actorId,
  }).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 503 });
  return NextResponse.json({ ok: true, id: data?.id });
}

export async function PATCH(req: Request) {
  if (req.headers.get("x-eval-demo") === "1") {
    return NextResponse.json({ error: "시연 모드에서는 지시를 저장하지 않습니다." }, { status: 403 });
  }
  const staff = await requireStaff(req);
  if (!staff.ok) return staff.res;
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  const status = String(body.status || "");
  const note = String(body.note || "");
  if (!id || !["open", "doing", "done"].includes(status)) {
    return NextResponse.json({ error: "처리 상태가 올바르지 않습니다." }, { status: 400 });
  }
  const admin = await requireAdmin(req);
  if (localDbUrl()) {
    const prev = await localServiceQuery("select * from eval_directives where id=$1", [id]);
    const row = prev?.rows[0] as Record<string, unknown> | undefined;
    if (!row) return NextResponse.json({ error: "지시가 없습니다." }, { status: 404 });
    const d = mapRow(row);
    if (!directiveVisible(d, staff.identity.evalRole, staff.identity.leaveRecordId, admin.ok)) {
      return NextResponse.json({ error: "이 지시를 처리할 수 없습니다." }, { status: 403 });
    }
    const notes = [...(d.notes || []), {
      at: new Date().toISOString(),
      actorName: staff.identity.name,
      actorId: staff.identity.leaveRecordId,
      text: note,
      status: status as DirectiveNote["status"],
    }];
    const up = await localServiceQuery(
      "update eval_directives set status=$2, notes=$3::jsonb, updated_at=now() where id=$1",
      [id, status, JSON.stringify(notes)]
    );
    if (!up) return NextResponse.json({ error: "저장 실패" }, { status: 503 });
    return NextResponse.json({ ok: true });
  }
  const token = cookieToken(req);
  const rpc = evalAnon();
  if (rpc && token) {
    const { error } = await rpc.rpc("eval_update_directive_status", { token, p_id: id, p_status: status, p_note: note });
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "저장 실패. 지시 테이블이 아직 없습니다." }, { status: 503 });
}

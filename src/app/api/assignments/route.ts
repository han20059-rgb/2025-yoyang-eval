import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { cookieToken, requireStaff } from "@/lib/staffSession";
import { asRole } from "@/lib/assignmentMerge";
import { localDbUrl, localServiceQuery } from "@/lib/evalLocalDb";
import { evalAnon, evalService } from "@/lib/evalSb";
import type { RoleId } from "@/data/duties";

export const runtime = "nodejs";

function mapRows(rows: unknown[]) {
  return rows.map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      indicatorId: Number(row.indicator_id),
      mark: String(row.mark),
      roles: ((row.roles as string[]) || []).map((x) => asRole(x)).filter(Boolean),
      excludeRoles: ((row.exclude_roles as string[]) || []).map((x) => asRole(x)).filter(Boolean),
      recheckRoles: ((row.recheck_roles as string[]) || []).map((x) => asRole(x)).filter(Boolean),
      staffNames: (row.staff_names as string[]) || [],
      reason: String(row.reason || ""),
      actorName: String(row.actor_name || ""),
      updatedAt: String(row.updated_at || ""),
    };
  });
}

export async function GET(req: Request) {
  if (req.headers.get("x-eval-demo") === "1") {
    return NextResponse.json({ error: "시연 모드에서는 실제 배정을 읽지 않습니다." }, { status: 403 });
  }
  const admin = await requireAdmin(req);
  const staff = admin.ok ? null : await requireStaff(req);
  if (!admin.ok && !staff?.ok) {
    return NextResponse.json({ items: [], storage: "anon", admin: false });
  }
  if (localDbUrl()) {
    const r = await localServiceQuery(
      "select indicator_id, mark, roles, exclude_roles, recheck_roles, staff_names, reason, actor_name, updated_at from eval_assignment_overrides"
    );
    if (!r) return NextResponse.json({ error: "담당 배정을 읽지 못했습니다.", items: [], storage: "unready" }, { status: 503 });
    return NextResponse.json({ items: mapRows(r.rows), storage: "supabase", admin: admin.ok });
  }
  const token = cookieToken(req);
  const rpc = evalAnon();
  const svc = evalService();
  if (rpc && token) {
    const { data, error } = await rpc.rpc("eval_list_assignment_overrides", { token });
    if (!error) {
      return NextResponse.json({ items: mapRows((data as unknown[]) || []), storage: "supabase", admin: admin.ok });
    }
  }
  if (svc) {
    const { data, error } = await svc
      .from("eval_assignment_overrides")
      .select("indicator_id, mark, roles, exclude_roles, recheck_roles, staff_names, reason, actor_name, updated_at");
    if (error) {
      return NextResponse.json({ error: "담당 배정을 읽지 못했습니다.", detail: error.message, items: [] }, { status: 503 });
    }
    return NextResponse.json({ items: mapRows(data || []), storage: "supabase", admin: admin.ok });
  }
  return NextResponse.json({ error: "담당 배정 저장소가 아직 없습니다. 운영 마이그레이션 전입니다.", storage: "unready", items: [] }, { status: 503 });
}

export async function POST(req: Request) {
  if (req.headers.get("x-eval-demo") === "1") {
    return NextResponse.json({ error: "시연 모드에서는 배정을 저장하지 않습니다." }, { status: 403 });
  }
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  const body = (await req.json()) as {
    changes?: { indicatorId: number; mark: string; roles: RoleId[]; excludeRoles?: RoleId[]; staffNames?: string[]; reason?: string }[];
  };
  const changes = body.changes || [];
  const actorName = gate.identity.name;
  const actorId = gate.identity.leaveRecordId;
  const results: { indicatorId: number; mark: string; ok: boolean; error?: string; before: string[]; after: string[] }[] = [];
  if (localDbUrl()) {
    for (const ch of changes) {
      if (!ch.indicatorId || !ch.mark) {
        results.push({ indicatorId: ch.indicatorId, mark: ch.mark, ok: false, error: "기준이 없습니다.", before: [], after: [] });
        continue;
      }
      const intended = [...new Set((ch.roles || []).map((r) => asRole(r)).filter(Boolean))] as RoleId[];
      const exclude = [...new Set((ch.excludeRoles || []).map((r) => asRole(r)).filter(Boolean))] as RoleId[];
      const after = intended.filter((r) => !exclude.includes(r));
      const prev = await localServiceQuery(
        "select roles, recheck_roles from eval_assignment_overrides where indicator_id=$1 and mark=$2",
        [ch.indicatorId, ch.mark]
      );
      const before = ((prev?.rows[0]?.roles as string[]) || []).filter(Boolean);
      const prevRecheck = ((prev?.rows[0]?.recheck_roles as string[]) || []).filter(Boolean);
      const added = after.filter((r) => !before.includes(r));
      const recheck = [...new Set([...prevRecheck.filter((r) => after.includes(r as RoleId)), ...added])];
      const up = await localServiceQuery(
        `insert into eval_assignment_overrides(indicator_id, mark, roles, exclude_roles, recheck_roles, staff_names, reason, actor_name, actor_leave_record_id, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
         on conflict (indicator_id, mark) do update set roles=excluded.roles, exclude_roles=excluded.exclude_roles, recheck_roles=excluded.recheck_roles, staff_names=excluded.staff_names, reason=excluded.reason, actor_name=excluded.actor_name, actor_leave_record_id=excluded.actor_leave_record_id, updated_at=now()`,
        [ch.indicatorId, ch.mark, after, exclude, recheck, ch.staffNames || [], ch.reason || "", actorName, actorId]
      );
      if (!up) {
        results.push({ indicatorId: ch.indicatorId, mark: ch.mark, ok: false, error: "저장 실패", before, after });
        continue;
      }
      await localServiceQuery(
        "insert into eval_assignment_events(indicator_id, mark, before_roles, after_roles, reason, actor_name, actor_leave_record_id, as_admin) values ($1,$2,$3,$4,$5,$6,$7,true)",
        [ch.indicatorId, ch.mark, before, after, ch.reason || "", actorName, actorId]
      );
      results.push({ indicatorId: ch.indicatorId, mark: ch.mark, ok: true, before, after });
    }
    const failed = results.filter((r) => !r.ok);
    return NextResponse.json({ ok: failed.length === 0, saved: results.filter((r) => r.ok).length, failed, results });
  }
  const token = cookieToken(req);
  const rpc = evalAnon();
  const svc = evalService();
  if (!rpc && !svc) {
    return NextResponse.json({ error: "저장 실패. 담당 배정 테이블이 아직 없습니다.", storage: "unready" }, { status: 503 });
  }
  for (const ch of changes) {
    if (!ch.indicatorId || !ch.mark) {
      results.push({ indicatorId: ch.indicatorId, mark: ch.mark, ok: false, error: "기준이 없습니다.", before: [], after: [] });
      continue;
    }
    const intended = [...new Set((ch.roles || []).map((r) => asRole(r)).filter(Boolean))] as RoleId[];
    const exclude = [...new Set((ch.excludeRoles || []).map((r) => asRole(r)).filter(Boolean))] as RoleId[];
    const after = intended.filter((r) => !exclude.includes(r));
    if (rpc && token) {
      const { data, error } = await rpc.rpc("eval_save_assignment_change", {
        token,
        p_indicator_id: ch.indicatorId,
        p_mark: ch.mark,
        p_roles: after,
        p_exclude_roles: exclude,
        p_staff_names: ch.staffNames || [],
        p_reason: ch.reason || "",
      });
      if (error) {
        results.push({ indicatorId: ch.indicatorId, mark: ch.mark, ok: false, error: error.message, before: [], after });
        continue;
      }
      const payload = (data || {}) as { before?: string[]; after?: string[] };
      results.push({ indicatorId: ch.indicatorId, mark: ch.mark, ok: true, before: payload.before || [], after: payload.after || after });
      continue;
    }
    if (!svc) {
      results.push({ indicatorId: ch.indicatorId, mark: ch.mark, ok: false, error: "저장소가 없습니다.", before: [], after });
      continue;
    }
    const { data: prev } = await svc
      .from("eval_assignment_overrides")
      .select("roles, exclude_roles, recheck_roles")
      .eq("indicator_id", ch.indicatorId)
      .eq("mark", ch.mark)
      .maybeSingle();
    const before = ((prev?.roles || []) as string[]).filter(Boolean);
    const prevRecheck = ((prev?.recheck_roles || []) as string[]).filter(Boolean);
    const added = after.filter((r) => !before.includes(r));
    const recheck = [...new Set([...prevRecheck.filter((r) => after.includes(r as RoleId)), ...added])];
    const { error } = await svc.from("eval_assignment_overrides").upsert({
      indicator_id: ch.indicatorId,
      mark: ch.mark,
      roles: after,
      exclude_roles: exclude,
      recheck_roles: recheck,
      staff_names: ch.staffNames || [],
      reason: ch.reason || "",
      actor_name: actorName,
      actor_leave_record_id: actorId,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      results.push({ indicatorId: ch.indicatorId, mark: ch.mark, ok: false, error: error.message, before, after });
      continue;
    }
    await svc.from("eval_assignment_events").insert({
      indicator_id: ch.indicatorId,
      mark: ch.mark,
      before_roles: before,
      after_roles: after,
      reason: ch.reason || "",
      actor_name: actorName,
      actor_leave_record_id: actorId,
      as_admin: true,
    });
    results.push({ indicatorId: ch.indicatorId, mark: ch.mark, ok: true, before, after });
  }
  const failed = results.filter((r) => !r.ok);
  return NextResponse.json({ ok: failed.length === 0, saved: results.filter((r) => r.ok).length, failed, results });
}

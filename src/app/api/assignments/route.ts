import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { cookieToken, requireStaff } from "@/lib/staffSession";
import { asRole } from "@/lib/assignmentMerge";
import { localDbUrl, localServiceQuery } from "@/lib/evalLocalDb";
import { evalAnon, evalService } from "@/lib/evalSb";
import type { RoleId } from "@/data/duties";

export const runtime = "nodejs";

type Change = {
  indicatorId: number;
  mark: string;
  roles: RoleId[];
  excludeRoles?: RoleId[];
  staffNames?: string[];
  staffIds?: number[];
  reason?: string;
};

function mapRows(rows: unknown[]) {
  return rows.map((raw) => {
    const row = raw as Record<string, unknown>;
    const names = (row.staff_names as string[]) || [];
    const ids = ((row.staff_ids as number[]) || []).map((n) => Number(n)).filter(Boolean);
    return {
      indicatorId: Number(row.indicator_id),
      mark: String(row.mark),
      roles: ((row.roles as string[]) || []).map((x) => asRole(x)).filter(Boolean),
      excludeRoles: ((row.exclude_roles as string[]) || []).map((x) => asRole(x)).filter(Boolean),
      recheckRoles: ((row.recheck_roles as string[]) || []).map((x) => asRole(x)).filter(Boolean),
      staffNames: names,
      staffIds: ids.length ? ids : names.map((raw) => {
        const m = String(raw).match(/\|\#(\d+)$/);
        return m ? Number(m[1]) : 0;
      }).filter(Boolean),
      reason: String(row.reason || ""),
      actorName: String(row.actor_name || ""),
      updatedAt: String(row.updated_at || ""),
    };
  });
}

async function localQ(sql: string, params: unknown[] = []) {
  try {
    return await localServiceQuery(sql, params);
  } catch (e) {
    return { rows: [] as Record<string, unknown>[], error: e instanceof Error ? e.message : "query" };
  }
}

function missingRelation(err?: string) {
  return /does not exist|42703|42704/i.test(err || "");
}

function publicSaveError(err?: string) {
  const s = err || "";
  if (/column .* does not exist|42703/i.test(s)) return "담당을 저장하지 못했습니다. 저장소 함수를 고쳐야 합니다.";
  if (/unauthorized|forbidden/i.test(s)) return "저장 권한이 없습니다.";
  if (/timeout|timed out/i.test(s)) return "저장이 지연되어 중단했습니다. 다시 시도해 주세요.";
  return "담당을 저장하지 못했습니다. 다시 시도해 주세요.";
}

async function localLoadRows() {
  const attempts = [
    "select indicator_id, mark, roles, exclude_roles, recheck_roles, staff_names, staff_ids, reason, actor_name, updated_at from eval_assignment_overrides",
    "select indicator_id, mark, roles, exclude_roles, recheck_roles, staff_names, reason, actor_name, updated_at from eval_assignment_overrides",
    "select indicator_id, mark, roles, staff_names, reason, actor_name, updated_at from eval_assignment_overrides",
  ];
  let last = "";
  for (const sql of attempts) {
    const r = await localQ(sql);
    if (!r) return { rows: null as unknown[] | null, error: "no-local" };
    if (!("error" in r && r.error)) return { rows: r.rows, error: "" };
    last = String(r.error);
    if (!missingRelation(last) && !/staff_ids|exclude_roles|recheck_roles/i.test(last)) {
      return { rows: null, error: last };
    }
  }
  return { rows: null, error: last };
}

async function localSaveChange(
  ch: Change,
  after: RoleId[],
  exclude: RoleId[],
  recheck: string[],
  before: string[],
  actorName: string,
  actorId: number
) {
  const names = ch.staffNames || [];
  const ids = ch.staffIds || [];
  const attempts: { sql: string; params: unknown[] }[] = [
    {
      sql: `insert into eval_assignment_overrides(indicator_id, mark, roles, exclude_roles, recheck_roles, staff_names, staff_ids, reason, actor_name, actor_leave_record_id, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
         on conflict (indicator_id, mark) do update set roles=excluded.roles, exclude_roles=excluded.exclude_roles, recheck_roles=excluded.recheck_roles, staff_names=excluded.staff_names, staff_ids=excluded.staff_ids, reason=excluded.reason, actor_name=excluded.actor_name, actor_leave_record_id=excluded.actor_leave_record_id, updated_at=now()`,
      params: [ch.indicatorId, ch.mark, after, exclude, recheck, names, ids, ch.reason || "", actorName, actorId],
    },
    {
      sql: `insert into eval_assignment_overrides(indicator_id, mark, roles, exclude_roles, recheck_roles, staff_names, reason, actor_name, actor_leave_record_id, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
         on conflict (indicator_id, mark) do update set roles=excluded.roles, exclude_roles=excluded.exclude_roles, recheck_roles=excluded.recheck_roles, staff_names=excluded.staff_names, reason=excluded.reason, actor_name=excluded.actor_name, actor_leave_record_id=excluded.actor_leave_record_id, updated_at=now()`,
      params: [ch.indicatorId, ch.mark, after, exclude, recheck, names, ch.reason || "", actorName, actorId],
    },
    {
      sql: `insert into eval_assignment_overrides(indicator_id, mark, roles, staff_names, reason, actor_name, updated_at)
         values ($1,$2,$3,$4,$5,$6,now())
         on conflict (indicator_id, mark) do update set roles=excluded.roles, staff_names=excluded.staff_names, reason=excluded.reason, actor_name=excluded.actor_name, updated_at=now()`,
      params: [ch.indicatorId, ch.mark, after, names, ch.reason || "", actorName],
    },
  ];
  let last = "";
  for (const a of attempts) {
    const up = await localQ(a.sql, a.params);
    if (up && !("error" in up && up.error)) {
      await localQ(
        "insert into eval_assignment_events(indicator_id, mark, before_roles, after_roles, reason, actor_name, actor_leave_record_id, as_admin) values ($1,$2,$3,$4,$5,$6,$7,true)",
        [ch.indicatorId, ch.mark, before, after, ch.reason || "", actorName, actorId]
      );
      return { ok: true as const, error: "" };
    }
    last = (up && "error" in up && up.error) || "저장 실패";
  }
  return { ok: false as const, error: last };
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
    const loaded = await localLoadRows();
    if (loaded.rows) {
      return NextResponse.json({ items: mapRows(loaded.rows), storage: "supabase", admin: admin.ok });
    }
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
    const wide = await svc
      .from("eval_assignment_overrides")
      .select("indicator_id, mark, roles, exclude_roles, recheck_roles, staff_names, staff_ids, reason, actor_name, updated_at");
    if (!wide.error) {
      return NextResponse.json({ items: mapRows(wide.data || []), storage: "supabase", admin: admin.ok });
    }
    const mid = await svc
      .from("eval_assignment_overrides")
      .select("indicator_id, mark, roles, exclude_roles, recheck_roles, staff_names, reason, actor_name, updated_at");
    if (!mid.error) {
      return NextResponse.json({ items: mapRows(mid.data || []), storage: "supabase", admin: admin.ok });
    }
    const slim = await svc.from("eval_assignment_overrides").select("indicator_id, mark, roles, staff_names, reason, actor_name, updated_at");
    if (slim.error) {
      return NextResponse.json({ error: "담당 배정을 읽지 못했습니다.", items: [] }, { status: 503 });
    }
    return NextResponse.json({ items: mapRows(slim.data || []), storage: "supabase", admin: admin.ok });
  }
  return NextResponse.json({ error: "담당 배정 저장소가 아직 없습니다. 운영 마이그레이션 전입니다.", storage: "unready", items: [] }, { status: 503 });
}

export async function POST(req: Request) {
  if (req.headers.get("x-eval-demo") === "1") {
    return NextResponse.json({ error: "시연 모드에서는 배정을 저장하지 않습니다." }, { status: 403 });
  }
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  const body = (await req.json()) as { changes?: Change[] };
  const changes = body.changes || [];
  const actorName = gate.identity.name;
  const actorId = gate.identity.leaveRecordId;
  const results: { indicatorId: number; mark: string; ok: boolean; error?: string; before: string[]; after: string[] }[] = [];

  async function saveOne(ch: Change) {
    if (!ch.indicatorId || !ch.mark) {
      results.push({ indicatorId: ch.indicatorId, mark: ch.mark, ok: false, error: "기준이 없습니다.", before: [], after: [] });
      return;
    }
    const intended = [...new Set((ch.roles || []).map((r) => asRole(r)).filter(Boolean))] as RoleId[];
    const exclude = [...new Set((ch.excludeRoles || []).map((r) => asRole(r)).filter(Boolean))] as RoleId[];
    const after = intended.filter((r) => !exclude.includes(r));
    if (localDbUrl()) {
      const prev = await localQ("select roles, recheck_roles from eval_assignment_overrides where indicator_id=$1 and mark=$2", [ch.indicatorId, ch.mark]);
      const before = ((prev?.rows[0]?.roles as string[]) || []).filter(Boolean);
      const prevRecheck = ((prev?.rows[0]?.recheck_roles as string[]) || []).filter(Boolean);
      const added = after.filter((r) => !before.includes(r));
      const recheck = [...new Set([...prevRecheck.filter((r) => after.includes(r as RoleId)), ...added])];
      if (prev && !("error" in prev && prev.error && missingRelation(String(prev.error)))) {
        const saved = await localSaveChange(ch, after, exclude, recheck, before, actorName, actorId);
        if (saved.ok) {
          results.push({ indicatorId: ch.indicatorId, mark: ch.mark, ok: true, before, after });
          return;
        }
        if (!missingRelation(saved.error)) {
          console.error("[assignments]", { indicatorId: ch.indicatorId, mark: ch.mark, error: saved.error });
          results.push({ indicatorId: ch.indicatorId, mark: ch.mark, ok: false, error: publicSaveError(saved.error), before, after });
          return;
        }
      }
    }
    const token = cookieToken(req);
    const rpc = evalAnon();
    const svc = evalService();
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
        console.error("[assignments]", { indicatorId: ch.indicatorId, mark: ch.mark, error: error.message });
        results.push({ indicatorId: ch.indicatorId, mark: ch.mark, ok: false, error: publicSaveError(error.message), before: [], after });
        return;
      }
      const payload = (data || {}) as { before?: string[]; after?: string[] };
      results.push({ indicatorId: ch.indicatorId, mark: ch.mark, ok: true, before: payload.before || [], after: payload.after || after });
      return;
    }
    if (!svc) {
      results.push({ indicatorId: ch.indicatorId, mark: ch.mark, ok: false, error: "저장소가 없습니다.", before: [], after });
      return;
    }
    const { data: prev } = await svc
      .from("eval_assignment_overrides")
      .select("indicator_id, mark, roles, exclude_roles, recheck_roles, staff_names, staff_ids, reason, actor_name, updated_at")
      .eq("indicator_id", ch.indicatorId)
      .eq("mark", ch.mark)
      .maybeSingle();
    const before = ((prev?.roles || []) as string[]).filter(Boolean);
    const prevRecheck = ((prev?.recheck_roles || []) as string[]).filter(Boolean);
    const added = after.filter((r) => !before.includes(r));
    const recheck = [...new Set([...prevRecheck.filter((r) => after.includes(r as RoleId)), ...added])];
    const full = {
      indicator_id: ch.indicatorId,
      mark: ch.mark,
      roles: after,
      exclude_roles: exclude,
      recheck_roles: recheck,
      staff_names: ch.staffNames || [],
      staff_ids: ch.staffIds || [],
      reason: ch.reason || "",
      actor_name: actorName,
      actor_leave_record_id: actorId,
      updated_at: new Date().toISOString(),
    };
    let { error } = await svc.from("eval_assignment_overrides").upsert(full);
    if (error && /staff_ids/i.test(error.message)) {
      const rest = { ...full };
      delete (rest as { staff_ids?: number[] }).staff_ids;
      const retry = await svc.from("eval_assignment_overrides").upsert(rest);
      error = retry.error;
    }
    if (error) {
      console.error("[assignments]", { indicatorId: ch.indicatorId, mark: ch.mark, error: error.message });
      results.push({ indicatorId: ch.indicatorId, mark: ch.mark, ok: false, error: publicSaveError(error.message), before, after });
      return;
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

  for (const ch of changes) await saveOne(ch);
  const failed = results.filter((r) => !r.ok);
  return NextResponse.json({ ok: failed.length === 0, saved: results.filter((r) => r.ok).length, failed, results });
}

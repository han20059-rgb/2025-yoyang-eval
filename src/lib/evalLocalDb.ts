import { createHash, randomBytes } from "crypto";
import { mapJobType } from "@/lib/jobMap";
import type { StaffIdentity } from "@/lib/staffTypes";

type PgQuery = (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;

let query: PgQuery | null | undefined;

export function localDbUrl() {
  return process.env.EVAL_LOCAL_DATABASE_URL || "";
}

async function db(): Promise<PgQuery | null> {
  if (query !== undefined) return query;
  const url = localDbUrl();
  if (!url) {
    query = null;
    return null;
  }
  const pg = await import("pg");
  const pool = new pg.Pool({ connectionString: url });
  query = async (sql, params = []) => pool.query(sql, params);
  return query;
}

function identityOf(leaveRecordId: number, name: string, jobType: string): StaffIdentity {
  const mapped = mapJobType(jobType);
  return {
    leaveRecordId,
    name,
    jobType,
    evalRole: mapped.role,
    roleStatus: mapped.status,
    roleNote: mapped.note,
    isAdmin: false,
  };
}

export async function localLogin(yymmdd: string, pw: string) {
  const q = await db();
  if (!q) return null;
  const { rows } = await q(
    "select leave_record_id, name, job_type from eval_local_staff where yymmdd=$1 and pw=$2",
    [yymmdd, pw]
  );
  const row = rows[0];
  if (!row) return { ok: false as const, error: "로그인에 실패했습니다." };
  const token = randomBytes(24).toString("hex");
  await q("insert into eval_local_staff_tokens(token, leave_record_id) values ($1,$2)", [token, row.leave_record_id]);
  return {
    ok: true as const,
    token,
    identity: identityOf(Number(row.leave_record_id), String(row.name), String(row.job_type)),
  };
}

export async function localIdentity(token: string) {
  const q = await db();
  if (!q) return null;
  const { rows } = await q(
    `select s.leave_record_id, s.name, s.job_type
     from eval_local_staff_tokens t join eval_local_staff s on s.leave_record_id=t.leave_record_id
     where t.token=$1`,
    [token]
  );
  const row = rows[0];
  if (!row) return { ok: false as const, error: "로그인이 만료되었습니다." };
  return {
    ok: true as const,
    identity: identityOf(Number(row.leave_record_id), String(row.name), String(row.job_type)),
  };
}

export async function localServiceQuery(sql: string, params: unknown[] = []) {
  const q = await db();
  if (!q) return null;
  return q(sql, params);
}

export function actorKey(leaveRecordId: number) {
  return createHash("sha256").update(`eval-actor:${leaveRecordId}`).digest("hex").slice(0, 16);
}

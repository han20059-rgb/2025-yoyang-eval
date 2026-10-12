import { createHash, randomBytes } from "crypto";
import { mapJobType } from "@/lib/jobMap";
import type { StaffIdentity } from "@/lib/staffTypes";

type PgQuery = (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;

let query: PgQuery | null | undefined;

const LOCAL_DB_TIMEOUT_MS = 4000;

export function localDbUrl() {
  return process.env.EVAL_LOCAL_DATABASE_URL || "";
}

function withDeadline<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

async function db(): Promise<PgQuery | null> {
  if (query !== undefined) return query;
  const url = localDbUrl();
  if (!url) {
    query = null;
    return null;
  }
  try {
    const pg = await import("pg");
    const pool = new pg.Pool({
      connectionString: url,
      connectionTimeoutMillis: LOCAL_DB_TIMEOUT_MS,
      idleTimeoutMillis: 8000,
      max: 2,
    } as ConstructorParameters<typeof pg.Pool>[0]);
    const run: PgQuery = async (sql, params = []) =>
      withDeadline(pool.query(sql, params), LOCAL_DB_TIMEOUT_MS + 2000, "local-db-timeout");
    await run("select 1");
    query = run;
    return query;
  } catch {
    query = null;
    return null;
  }
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
  try {
    const q = await db();
    if (!q) return null;
    const { rows } = await q(
      "select leave_record_id, name, job_type from eval_local_staff where yymmdd=$1 and pw=$2",
      [yymmdd, pw]
    );
    const row = rows[0];
    if (!row) return null;
    const token = randomBytes(24).toString("hex");
    await q("insert into eval_local_staff_tokens(token, leave_record_id) values ($1,$2)", [token, row.leave_record_id]);
    return {
      ok: true as const,
      token,
      identity: identityOf(Number(row.leave_record_id), String(row.name), String(row.job_type)),
    };
  } catch {
    return null;
  }
}

export async function localIdentity(token: string) {
  try {
    const q = await db();
    if (!q) return null;
    const { rows } = await q(
      `select s.leave_record_id, s.name, s.job_type
       from eval_local_staff_tokens t join eval_local_staff s on s.leave_record_id=t.leave_record_id
       where t.token=$1`,
      [token]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      ok: true as const,
      identity: identityOf(Number(row.leave_record_id), String(row.name), String(row.job_type)),
    };
  } catch {
    return null;
  }
}

export async function localServiceQuery(sql: string, params: unknown[] = []) {
  try {
    const q = await db();
    if (!q) return null;
    return await q(sql, params);
  } catch {
    return null;
  }
}

export function actorKey(leaveRecordId: number) {
  return createHash("sha256").update(`eval-actor:${leaveRecordId}`).digest("hex").slice(0, 16);
}

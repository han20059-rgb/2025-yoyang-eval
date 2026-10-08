import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { cookieToken } from "@/lib/staffSession";
import { localDbUrl, localServiceQuery } from "@/lib/evalLocalDb";
import { evalAnon, evalService } from "@/lib/evalSb";

export const runtime = "nodejs";

function deptOf(jobType: string) {
  if (/시설장|원장/.test(jobType)) return "시설장";
  if (/사무원|사무국|조리|위생|간호|사회복지|물리치료|관리인|영양|운전/.test(jobType)) return "지원부서";
  if (/요양보호/.test(jobType) || !jobType.trim()) return "요양";
  return "기타";
}

export async function GET(req: Request) {
  if (req.headers.get("x-eval-demo") === "1") {
    return NextResponse.json({ error: "시연 모드에서는 직원 목록을 보지 않습니다." }, { status: 403 });
  }
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  if (localDbUrl()) {
    const r = await localServiceQuery("select leave_record_id, name, job_type from eval_local_staff order by name, leave_record_id");
    if (!r) return NextResponse.json({ error: "직원 목록을 읽지 못했습니다.", storage: "unready" }, { status: 503 });
    const items = r.rows.map((row) => {
      const jobType = String(row.job_type || "");
      return {
        leaveRecordId: Number(row.leave_record_id),
        name: String(row.name || ""),
        jobType,
        dept: deptOf(jobType),
        canLogin: true,
      };
    });
    return NextResponse.json({ items, storage: "supabase" });
  }
  const token = cookieToken(req);
  const rpc = evalAnon();
  if (rpc && token) {
    const { data, error } = await rpc.rpc("eval_list_staff_directory", { token });
    if (!error) return NextResponse.json({ items: data || [], storage: "supabase" });
    return NextResponse.json({ error: "직원 목록을 읽지 못했습니다.", detail: error.message, items: [] }, { status: 503 });
  }
  const svc = evalService();
  if (!svc) return NextResponse.json({ error: "직원 목록 저장소가 없습니다.", storage: "unready" }, { status: 503 });
  return NextResponse.json({ error: "직원 목록은 관리자 토큰으로만 읽습니다.", storage: "unready", items: [] }, { status: 503 });
}

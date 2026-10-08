import { NextResponse } from "next/server";
import { isStaffAdmin } from "@/lib/adminAuth";
import { requireStaff } from "@/lib/staffSession";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const gate = await requireStaff(req);
  if (!gate.ok) return gate.res;
  const admin = await isStaffAdmin(gate.identity.leaveRecordId);
  return NextResponse.json({
    ok: true,
    identity: { ...gate.identity, isAdmin: admin.admin },
  });
}

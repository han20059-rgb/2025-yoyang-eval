import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getEdition, readStoredFile } from "@/lib/manualStore";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  const { id } = await ctx.params;
  const kind = new URL(req.url).searchParams.get("kind");
  if (kind !== "pdf" && kind !== "hwp") {
    return NextResponse.json({ error: "kind=pdf 또는 hwp" }, { status: 400 });
  }
  const edition = await getEdition(id);
  const file = edition?.files[kind];
  if (!file) return NextResponse.json({ error: "원본 파일이 없습니다." }, { status: 404 });
  const buf = await readStoredFile(file.stored);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": kind === "pdf" ? "application/pdf" : "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    },
  });
}

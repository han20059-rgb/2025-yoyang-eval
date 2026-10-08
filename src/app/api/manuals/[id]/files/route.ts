import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getEdition, saveFile } from "@/lib/manualStore";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  const { id } = await ctx.params;
  const edition = await getEdition(id);
  if (!edition) return NextResponse.json({ error: "없습니다." }, { status: 404 });
  const form = await req.formData();
  const pdf = form.get("pdf");
  const hwp = form.get("hwp");
  let next = edition;
  if (pdf instanceof File && pdf.size > 0) {
    next = await saveFile(id, "pdf", pdf.name, Buffer.from(await pdf.arrayBuffer()));
  }
  if (hwp instanceof File && hwp.size > 0) {
    next = await saveFile(id, "hwp", hwp.name, Buffer.from(await hwp.arrayBuffer()));
  }
  if (!next.files.pdf && !next.files.hwp) {
    return NextResponse.json({ error: "추가할 파일이 없습니다." }, { status: 400 });
  }
  return NextResponse.json({
    edition: next,
    note: "같은 등록본에 나머지 형식을 추가했습니다. 파일명만으로 같은 배포본이라고 단정하지 마세요. 추출을 다시 실행하세요.",
  });
}

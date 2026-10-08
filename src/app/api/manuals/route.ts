import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { createEdition, listEditions, saveFile } from "@/lib/manualStore";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  const editions = await listEditions();
  return NextResponse.json({
    editions: editions.map((e) => ({
      ...e,
      extracts: {
        pdf: e.extracts.pdf ? { status: e.extracts.pdf.status, pageCount: e.extracts.pdf.pageCount, error: e.extracts.pdf.error } : undefined,
        hwp: e.extracts.hwp ? { status: e.extracts.hwp.status, pageCount: e.extracts.hwp.pageCount, error: e.extracts.hwp.error } : undefined,
      },
    })),
    staffNote: "직원 화면은 기존 번들 매뉴얼을 유지합니다. 검토 전 확정본으로 노출하지 않습니다.",
  });
}

export async function POST(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
  const form = await req.formData();
  const pdf = form.get("pdf");
  const hwp = form.get("hwp");
  const hasPdf = pdf instanceof File && pdf.size > 0;
  const hasHwp = hwp instanceof File && hwp.size > 0;
  if (!hasPdf && !hasHwp) {
    return NextResponse.json({ error: "PDF 또는 아래한글 파일 중 하나 이상을 등록하세요. 둘 다 필수는 아닙니다." }, { status: 400 });
  }
  const edition = await createEdition({
    evalYear: String(form.get("evalYear") || ""),
    docKind: String(form.get("docKind") || ""),
    publishedOn: String(form.get("publishedOn") || ""),
    appliedOn: String(form.get("appliedOn") || ""),
    source: String(form.get("source") || ""),
    editionKind: form.get("editionKind") === "revision" ? "revision" : "original",
    parentId: String(form.get("parentId") || ""),
    evalCycleNote: String(form.get("evalCycleNote") || ""),
  });
  if (hasPdf) {
    const buf = Buffer.from(await pdf.arrayBuffer());
    await saveFile(edition.id, "pdf", pdf.name, buf);
  }
  if (hasHwp) {
    const buf = Buffer.from(await hwp.arrayBuffer());
    await saveFile(edition.id, "hwp", hwp.name, buf);
  }
  const saved = (await (await import("@/lib/manualStore")).getEdition(edition.id))!;
  return NextResponse.json({ edition: saved });
}

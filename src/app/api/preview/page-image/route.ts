import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const page = Number(new URL(req.url).searchParams.get("page") || 0);
  const kind = new URL(req.url).searchParams.get("file") || "";
  if (!page && !kind) return NextResponse.json({ error: "page 또는 file" }, { status: 400 });
  const name = kind || `pdf-${page}.png`;
  if (!/^[\w.\-]+$/.test(name)) return NextResponse.json({ error: "잘못된 이름" }, { status: 400 });
  try {
    const buf = await readFile(join(process.cwd(), "data", "manual-store", "page-images", name));
    const type = name.endsWith(".jpg") ? "image/jpeg" : "image/png";
    return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": type, "Cache-Control": "private, max-age=3600" } });
  } catch {
    return NextResponse.json({ error: "이미지가 아직 없습니다." }, { status: 404 });
  }
}

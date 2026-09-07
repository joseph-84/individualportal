import { NextResponse, type NextRequest } from "next/server";
import { apiRequirePerm } from "@/lib/guard";
import { listDir, ensureDir, UnsafePathError } from "@/lib/files";

export async function GET(req: NextRequest) {
  const auth = await apiRequirePerm("files", 1);
  if ("error" in auth) return auth.error;

  const dir = req.nextUrl.searchParams.get("dir") || "";
  try {
    const entries = await listDir(dir);
    return NextResponse.json({ dir, entries });
  } catch (e) {
    if (e instanceof UnsafePathError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "폴더를 읽을 수 없습니다." }, { status: 404 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await apiRequirePerm("files", 2);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  if (!body || body.action !== "mkdir" || typeof body.dir !== "string") {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  try {
    await ensureDir(body.dir);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof UnsafePathError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "폴더를 만들 수 없습니다." }, { status: 500 });
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { apiRequirePerm } from "@/lib/guard";
import { listDir, ensureDir, deleteEntry, renameOrMoveEntry, UnsafePathError } from "@/lib/files";
import { writeAudit } from "@/lib/audit";

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
  if (!body || typeof body.action !== "string") {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    if (body.action === "mkdir" && typeof body.dir === "string") {
      await ensureDir(body.dir);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "delete" && typeof body.path === "string") {
      await deleteEntry(body.path);
      await writeAudit(auth.user, "file.delete", body.path);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "rename" && typeof body.from === "string" && typeof body.to === "string") {
      await renameOrMoveEntry(body.from, body.to);
      await writeAudit(auth.user, "file.rename", body.from, { to: body.to });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  } catch (e) {
    if (e instanceof UnsafePathError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "작업을 완료할 수 없습니다." }, { status: 500 });
  }
}

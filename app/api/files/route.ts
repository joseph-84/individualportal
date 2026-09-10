import { NextResponse, type NextRequest } from "next/server";
import { apiRequirePerm } from "@/lib/guard";
import { listDir, ensureDir, deleteEntry, renameOrMoveEntry, copyEntry, UnsafePathError } from "@/lib/files";
import { isKbPath, listKbEntries, kbRootEntry } from "@/lib/kb-files";
import { writeAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const auth = await apiRequirePerm("files", 1);
  if ("error" in auth) return auth.error;

  const dir = req.nextUrl.searchParams.get("dir") || "";
  try {
    if (isKbPath(dir)) {
      const entries = await listKbEntries(dir);
      return NextResponse.json({ dir, entries, readOnly: true });
    }
    const entries = await listDir(dir);
    if (dir === "") entries.unshift(kbRootEntry);
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
  if (
    [body.dir, body.path, body.from, body.to].some((p) => typeof p === "string" && isKbPath(p))
  ) {
    return NextResponse.json({ error: `지식베이스 문서는 위키에서 관리하세요 (읽기 전용).` }, { status: 400 });
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
    if (body.action === "copy" && typeof body.from === "string" && typeof body.to === "string") {
      await copyEntry(body.from, body.to);
      await writeAudit(auth.user, "file.copy", body.from, { to: body.to });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  } catch (e) {
    if (e instanceof UnsafePathError) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e && typeof e === "object" && "code" in e && (e.code === "EEXIST" || e.code === "ERR_FS_CP_EEXIST")) {
      return NextResponse.json({ error: "같은 이름의 파일/폴더가 이미 대상 위치에 있습니다." }, { status: 409 });
    }
    return NextResponse.json({ error: "작업을 완료할 수 없습니다." }, { status: 500 });
  }
}

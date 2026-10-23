import { NextResponse, type NextRequest } from "next/server";
import { apiRequirePerm } from "@/lib/guard";
import { listDir, ensureDir, deleteEntry, renameOrMoveEntry, copyEntry, writeFile, UnsafePathError } from "@/lib/files";
import { isKbPath, listKbEntries, kbRootEntry, resolveKbNote, renameOrMoveKbNote } from "@/lib/kb-files";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const auth = await apiRequirePerm("files", 1);
  if ("error" in auth) return auth.error;

  const dir = req.nextUrl.searchParams.get("dir") || "";
  try {
    if (isKbPath(dir)) {
      const entries = await listKbEntries(dir);
      return NextResponse.json({ dir, entries });
    }
    const entries = await listDir(dir);
    if (dir === "") entries.unshift(kbRootEntry);
    return NextResponse.json({ dir, entries });
  } catch (e) {
    if (e instanceof UnsafePathError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "폴더를 읽을 수 없습니다." }, { status: 404 });
  }
}

/** Every write action below branches on isKbPath -- a __kb__/<폴더>/<제목>.<형식> path is backed
 * by a Note row (Prisma), everything else by a real file under SYNC_FOLDER_PATH (lib/files.ts).
 * This keeps the file browser's UI from ever needing to know which backing store a selected
 * entry uses -- it always calls the same action shape, same as GET above. New-note creation is
 * the one exception (see app/actions/wiki.ts): it needs structured fields (title/folder/tags/
 * format), not just a path, so it stays a dedicated server action. */
export async function POST(req: NextRequest) {
  const auth = await apiRequirePerm("files", 2);
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body.action !== "string") {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    if (body.action === "mkdir" && typeof body.dir === "string") {
      if (isKbPath(body.dir)) {
        return NextResponse.json({ error: "지식베이스 폴더는 문서를 만들 때 폴더명을 지정하면 자동으로 생성됩니다." }, { status: 400 });
      }
      await ensureDir(body.dir);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "write" && typeof body.path === "string" && typeof body.content === "string") {
      if (isKbPath(body.path)) {
        const note = await resolveKbNote(body.path);
        if (!note) return NextResponse.json({ error: "문서를 찾을 수 없습니다." }, { status: 404 });
        await prisma.note.update({ where: { id: note.id }, data: { content: body.content } });
        await writeAudit(auth.user, "note.update", note.title);
        return NextResponse.json({ ok: true });
      }
      await writeFile(body.path, Buffer.from(body.content, "utf-8"));
      await writeAudit(auth.user, "file.write", body.path);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "delete" && typeof body.path === "string") {
      if (isKbPath(body.path)) {
        const note = await resolveKbNote(body.path);
        if (!note) return NextResponse.json({ error: "문서를 찾을 수 없습니다." }, { status: 404 });
        await prisma.note.delete({ where: { id: note.id } });
        await writeAudit(auth.user, "note.delete", note.title);
        return NextResponse.json({ ok: true });
      }
      await deleteEntry(body.path);
      await writeAudit(auth.user, "file.delete", body.path);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "rename" && typeof body.from === "string" && typeof body.to === "string") {
      if (isKbPath(body.from) || isKbPath(body.to)) {
        await renameOrMoveKbNote(body.from, body.to);
        await writeAudit(auth.user, "note.rename", body.from, { to: body.to });
        return NextResponse.json({ ok: true });
      }
      await renameOrMoveEntry(body.from, body.to);
      await writeAudit(auth.user, "file.rename", body.from, { to: body.to });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "copy" && typeof body.from === "string" && typeof body.to === "string") {
      if (isKbPath(body.from) || isKbPath(body.to)) {
        return NextResponse.json({ error: "지식베이스 문서는 복사를 지원하지 않습니다." }, { status: 400 });
      }
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

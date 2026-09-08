import { NextResponse, type NextRequest } from "next/server";
import path from "node:path";
import { apiRequirePerm } from "@/lib/guard";
import { readFileBuffer, UnsafePathError } from "@/lib/files";
import { isKbPath, resolveKbNote } from "@/lib/kb-files";
import { renderNote } from "@/lib/markdown";

/** Renders a .md/.html file (or KB note) to sanitized viewer HTML — the same rendering the
 * wiki editor's 뷰어 mode uses — so the file browser preview shows a readable document
 * instead of raw source. */
export async function GET(req: NextRequest) {
  const auth = await apiRequirePerm("files", 1);
  if ("error" in auth) return auth.error;

  const relPath = req.nextUrl.searchParams.get("path");
  if (!relPath) return NextResponse.json({ error: "path 파라미터가 필요합니다." }, { status: 400 });

  if (isKbPath(relPath)) {
    const note = await resolveKbNote(relPath);
    if (!note) return NextResponse.json({ error: "문서를 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ title: note.title, html: renderNote(note.content, note.format) });
  }

  const ext = path.extname(relPath).replace(".", "").toUpperCase();
  if (ext !== "MD" && ext !== "HTML") {
    return NextResponse.json({ error: "뷰어 미리보기를 지원하지 않는 형식입니다." }, { status: 400 });
  }

  try {
    const buf = await readFileBuffer(relPath);
    const format = ext === "HTML" ? "html" : "md";
    return NextResponse.json({ title: path.basename(relPath, path.extname(relPath)), html: renderNote(buf.toString("utf-8"), format) });
  } catch (e) {
    if (e instanceof UnsafePathError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "파일을 읽을 수 없습니다." }, { status: 404 });
  }
}

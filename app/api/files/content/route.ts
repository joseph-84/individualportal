import { NextResponse, type NextRequest } from "next/server";
import path from "node:path";
import { apiRequirePerm } from "@/lib/guard";
import { readFileBuffer, previewKind, UnsafePathError } from "@/lib/files";
import { isKbPath, resolveKbNote } from "@/lib/kb-files";

const MIME: Record<string, string> = {
  PNG: "image/png",
  JPG: "image/jpeg",
  JPEG: "image/jpeg",
  GIF: "image/gif",
  WEBP: "image/webp",
  SVG: "image/svg+xml",
  PDF: "application/pdf",
  MD: "text/markdown; charset=utf-8",
  TXT: "text/plain; charset=utf-8",
  CSV: "text/csv; charset=utf-8",
  LOG: "text/plain; charset=utf-8",
  JSON: "application/json; charset=utf-8",
  YML: "text/yaml; charset=utf-8",
  YAML: "text/yaml; charset=utf-8",
  TS: "text/plain; charset=utf-8",
  JS: "text/plain; charset=utf-8",
  PY: "text/plain; charset=utf-8",
  SH: "text/plain; charset=utf-8",
};

/** Always serves raw bytes with the correct Content-Type (never JSON-wrapped), so the URL
 * can be opened directly in a browser tab/window (used by the "새 창에서 보기" preview button). */
export async function GET(req: NextRequest) {
  const auth = await apiRequirePerm("files", 1);
  if ("error" in auth) return auth.error;

  const relPath = req.nextUrl.searchParams.get("path");
  const download = req.nextUrl.searchParams.get("download") === "1";
  if (!relPath) return NextResponse.json({ error: "path 파라미터가 필요합니다." }, { status: 400 });

  const ext = path.extname(relPath).replace(".", "").toUpperCase();

  if (isKbPath(relPath)) {
    const note = await resolveKbNote(relPath);
    if (!note) return NextResponse.json({ error: "문서를 찾을 수 없습니다." }, { status: 404 });
    const filename = `${note.title}.${note.format}`;
    return new NextResponse(note.content, {
      headers: {
        "Content-Type": download ? "application/octet-stream" : note.format === "html" ? "text/html; charset=utf-8" : "text/markdown; charset=utf-8",
        ...(download ? { "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"` } : {}),
      },
    });
  }

  try {
    const buf = await readFileBuffer(relPath);
    const filename = path.basename(relPath);

    if (download) {
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        },
      });
    }

    const contentType = MIME[ext] || (previewKind(ext) === "text" ? "text/plain; charset=utf-8" : "application/octet-stream");
    return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": contentType } });
  } catch (e) {
    if (e instanceof UnsafePathError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "파일을 읽을 수 없습니다." }, { status: 404 });
  }
}

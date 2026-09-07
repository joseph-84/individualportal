import { NextResponse, type NextRequest } from "next/server";
import path from "node:path";
import { apiRequirePerm } from "@/lib/guard";
import { readFileBuffer, previewKind, UnsafePathError } from "@/lib/files";

const MIME: Record<string, string> = {
  PNG: "image/png",
  JPG: "image/jpeg",
  JPEG: "image/jpeg",
  GIF: "image/gif",
  WEBP: "image/webp",
  SVG: "image/svg+xml",
  PDF: "application/pdf",
};

export async function GET(req: NextRequest) {
  const auth = await apiRequirePerm("files", 1);
  if ("error" in auth) return auth.error;

  const relPath = req.nextUrl.searchParams.get("path");
  const download = req.nextUrl.searchParams.get("download") === "1";
  if (!relPath) return NextResponse.json({ error: "path 파라미터가 필요합니다." }, { status: 400 });

  const ext = path.extname(relPath).replace(".", "").toUpperCase();

  try {
    const buf = await readFileBuffer(relPath);
    if (download) {
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(path.basename(relPath))}"`,
        },
      });
    }

    const kind = previewKind(ext);
    if (kind === "text") {
      return NextResponse.json({ kind, text: buf.toString("utf-8").slice(0, 200_000) });
    }
    if (kind === "image") {
      return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": MIME[ext] || "application/octet-stream" } });
    }
    if (kind === "pdf") {
      return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf" } });
    }
    return NextResponse.json({ kind: "binary" });
  } catch (e) {
    if (e instanceof UnsafePathError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "파일을 읽을 수 없습니다." }, { status: 404 });
  }
}

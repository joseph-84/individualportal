import { NextResponse, type NextRequest } from "next/server";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { readFileBuffer, UnsafePathError } from "@/lib/files";
import { isKbPath, resolveKbNote } from "@/lib/kb-files";
import { renderNote } from "@/lib/markdown";
import { shareAccessCookieName, verifyShareAccessToken } from "@/lib/share-otp-auth";

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
  HTML: "text/html; charset=utf-8",
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await prisma.shareLink.findUnique({ where: { token } });

  if (!link || link.revoked) {
    return new NextResponse("이 공유 링크는 더 이상 유효하지 않습니다.", { status: 404 });
  }

  if (link.scope === "email_otp") {
    const cookieVal = req.cookies.get(shareAccessCookieName(token))?.value;
    const okAccess = cookieVal ? await verifyShareAccessToken(cookieVal, token) : false;
    if (!okAccess) {
      return NextResponse.redirect(new URL(`/share/${token}`, req.url));
    }
  }

  const download = req.nextUrl.searchParams.get("download") === "1";

  if (isKbPath(link.relPath)) {
    const note = await resolveKbNote(link.relPath);
    if (!note) return new NextResponse("문서를 찾을 수 없습니다.", { status: 404 });
    prisma.shareLink.update({ where: { id: link.id }, data: { lastAccessedAt: new Date() } }).catch(() => {});

    const filename = `${note.title}.${note.format}`;
    if (download) {
      return new NextResponse(note.content, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        },
      });
    }
    // Inline (non-download) HTML is shown to external, non-owner viewers, so it's sanitized
    // first — unlike the internal wiki viewer/file browser, which trust the single account
    // that authors and reads every note. Downloading still returns the true original file.
    if (note.format === "html") {
      return new NextResponse(renderNote(note.content, "html"), { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    return new NextResponse(note.content, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
  }

  try {
    const buf = await readFileBuffer(link.relPath);
    prisma.shareLink.update({ where: { id: link.id }, data: { lastAccessedAt: new Date() } }).catch(() => {});

    const ext = path.extname(link.relPath).replace(".", "").toUpperCase();
    const filename = path.basename(link.relPath);

    if (download) {
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        },
      });
    }
    // Sanitize inline HTML for the same reason as the KB branch above — this is shown to
    // external, non-owner viewers.
    if (ext === "HTML") {
      return new NextResponse(renderNote(buf.toString("utf-8"), "html"), { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    return new NextResponse(new Uint8Array(buf), {
      headers: { "Content-Type": MIME[ext] || "application/octet-stream" },
    });
  } catch (e) {
    if (e instanceof UnsafePathError) return new NextResponse("잘못된 경로입니다.", { status: 400 });
    return new NextResponse("파일을 찾을 수 없습니다.", { status: 404 });
  }
}

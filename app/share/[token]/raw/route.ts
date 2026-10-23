import { NextResponse, type NextRequest } from "next/server";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { readFileBuffer, UnsafePathError } from "@/lib/files";
import { renderNote, renderShareDocument } from "@/lib/markdown";
import { shareAccessCookieName, verifyShareAccessToken } from "@/lib/share-otp-auth";
import { externalOrigin } from "@/lib/origin";

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
      return NextResponse.redirect(new URL(`/share/${token}`, externalOrigin(req.headers)));
    }
  }

  const download = req.nextUrl.searchParams.get("download") === "1";

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
    // Render + sanitize inline HTML/markdown since this is shown to external, non-owner viewers.
    if (ext === "HTML" || ext === "MD") {
      const body = renderNote(buf.toString("utf-8"), ext === "HTML" ? "html" : "md");
      const title = path.basename(link.relPath, path.extname(link.relPath));
      return new NextResponse(renderShareDocument(title, body), { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    return new NextResponse(new Uint8Array(buf), {
      headers: { "Content-Type": MIME[ext] || "application/octet-stream" },
    });
  } catch (e) {
    if (e instanceof UnsafePathError) return new NextResponse("잘못된 경로입니다.", { status: 400 });
    return new NextResponse("파일을 찾을 수 없습니다.", { status: 404 });
  }
}

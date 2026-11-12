import { NextResponse, type NextRequest } from "next/server";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { readFileBuffer, writeFile, previewKind, UnsafePathError } from "@/lib/files";
import { renderNote, renderShareDocument } from "@/lib/markdown";
import { shareAccessCookieName, verifyShareAccessToken } from "@/lib/share-otp-auth";
import { isShareLinkUsable, maskEmail } from "@/lib/share";
import { externalOrigin } from "@/lib/origin";

const MAX_WRITE_BYTES = 2_000_000;

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

  if (!link || !isShareLinkUsable(link)) {
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

/** Lets an external share viewer with write permission save edits back to the shared file --
 * gated the same way GET is (OTP cookie for email_otp scope, open for public scope), plus the
 * link's own permission and a check that the file is a kind that's actually text-editable
 * (images/pdf/binary have no edit UI to begin with, but this is the actual enforcement). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await prisma.shareLink.findUnique({ where: { token } });

  if (!link || !isShareLinkUsable(link)) {
    return new NextResponse("이 공유 링크는 더 이상 유효하지 않습니다.", { status: 404 });
  }
  if (link.permission !== "write") {
    return new NextResponse("이 공유 링크는 읽기 전용입니다.", { status: 403 });
  }
  const ext = path.extname(link.relPath).replace(".", "").toUpperCase();
  const kind = previewKind(ext);
  if (kind !== "text" && kind !== "html") {
    return new NextResponse("이 파일 형식은 수정할 수 없습니다.", { status: 403 });
  }
  if (link.scope === "email_otp") {
    const cookieVal = req.cookies.get(shareAccessCookieName(token))?.value;
    const okAccess = cookieVal ? await verifyShareAccessToken(cookieVal, token) : false;
    if (!okAccess) return new NextResponse("인증이 필요합니다.", { status: 401 });
  }

  let content: unknown;
  try {
    ({ content } = await req.json());
  } catch {
    return new NextResponse("잘못된 요청입니다.", { status: 400 });
  }
  if (typeof content !== "string") return new NextResponse("잘못된 요청입니다.", { status: 400 });
  if (Buffer.byteLength(content, "utf-8") > MAX_WRITE_BYTES) {
    return new NextResponse("파일이 너무 큽니다.", { status: 413 });
  }

  try {
    await writeFile(link.relPath, Buffer.from(content, "utf-8"));
  } catch (e) {
    if (e instanceof UnsafePathError) return new NextResponse("잘못된 경로입니다.", { status: 400 });
    return new NextResponse("저장할 수 없습니다.", { status: 500 });
  }

  await prisma.shareLink.update({ where: { id: link.id }, data: { lastAccessedAt: new Date() } });
  await prisma.auditLog.create({
    data: {
      actorId: null,
      actorName: `공유 링크 편집 (${link.scope === "public" ? "전체공개" : maskEmail(link.email || "")})`,
      action: "file.share_edit",
      target: link.relPath,
    },
  });

  return NextResponse.json({ ok: true });
}

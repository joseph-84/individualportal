import { cookies } from "next/headers";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { shareAccessCookieName, verifyShareAccessToken } from "@/lib/share-otp-auth";
import { isShareLinkUsable, maskEmail } from "@/lib/share";
import { previewKind } from "@/lib/files";
import { ShareOtpGate } from "@/components/ShareOtpGate";
import { ShareViewer } from "@/components/ShareViewer";

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await prisma.shareLink.findUnique({ where: { token } });

  const shellStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "#f5f4f1",
    color: "#1b1a18",
    fontFamily: "system-ui, sans-serif",
    display: "grid",
    placeItems: "center",
    padding: 20,
  };
  const cardStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 460,
    background: "#fff",
    border: "1px solid #e4e0da",
    borderRadius: 12,
    padding: 28,
  };
  // HTML documents are rendered in their own <iframe> (its own viewport, so its internal
  // @media queries respond to the iframe's own width, not the browser window's) — a narrow
  // 460px card squeezed it down into that document's own mobile breakpoint. Give HTML content
  // a much wider card so it renders at its intended desktop width.
  const wideCardStyle: React.CSSProperties = { ...cardStyle, maxWidth: 1180 };

  if (!link || !isShareLinkUsable(link)) {
    return (
      <div style={shellStyle}>
        <div style={cardStyle}>
          <h1 style={{ fontSize: 16, margin: "0 0 8px" }}>링크를 찾을 수 없습니다</h1>
          <p style={{ fontSize: 13, color: "#57534d" }}>
            {link && link.expiresAt && link.expiresAt <= new Date() ? "이 공유 링크는 만료되었습니다." : "이 공유 링크는 취소되었거나 존재하지 않습니다."}
          </p>
        </div>
      </div>
    );
  }

  const ext = path.extname(link.relPath).replace(".", "").toUpperCase();
  const kind = previewKind(ext);
  const fileName = path.basename(link.relPath);
  const editable = link.permission === "write" && (kind === "html" || kind === "text");

  if (link.scope === "public") {
    return (
      <div style={shellStyle}>
        <div style={kind === "html" ? wideCardStyle : cardStyle}>
          <ShareViewer token={token} fileName={fileName} kind={kind} ext={ext} editable={editable} />
        </div>
      </div>
    );
  }

  // email_otp scope
  const jar = await cookies();
  const cookieVal = jar.get(shareAccessCookieName(token))?.value;
  const verified = cookieVal ? await verifyShareAccessToken(cookieVal, token) : false;

  if (verified) {
    return (
      <div style={shellStyle}>
        <div style={kind === "html" ? wideCardStyle : cardStyle}>
          <ShareViewer token={token} fileName={fileName} kind={kind} ext={ext} editable={editable} />
        </div>
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <div style={cardStyle}>
        <ShareOtpGate token={token} fileName={fileName} maskedEmail={link.email ? maskEmail(link.email) : ""} />
      </div>
    </div>
  );
}

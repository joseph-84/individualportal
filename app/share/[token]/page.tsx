import { cookies } from "next/headers";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { shareAccessCookieName, verifyShareAccessToken } from "@/lib/share-otp-auth";
import { previewKind } from "@/lib/files";
import { isKbPath, resolveKbNote } from "@/lib/kb-files";
import { ShareOtpGate } from "@/components/ShareOtpGate";
import { ShareViewer } from "@/components/ShareViewer";

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}${"*".repeat(Math.max(1, user.length - visible.length))}@${domain}`;
}

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

  if (!link || link.revoked) {
    return (
      <div style={shellStyle}>
        <div style={cardStyle}>
          <h1 style={{ fontSize: 16, margin: "0 0 8px" }}>링크를 찾을 수 없습니다</h1>
          <p style={{ fontSize: 13, color: "#57534d" }}>이 공유 링크는 취소되었거나 존재하지 않습니다.</p>
        </div>
      </div>
    );
  }

  const ext = path.extname(link.relPath).replace(".", "").toUpperCase();
  const kind = previewKind(ext);
  const fileName = isKbPath(link.relPath)
    ? await resolveKbNote(link.relPath).then((n) => (n ? `${n.title}.${n.format}` : path.basename(link.relPath)))
    : path.basename(link.relPath);

  if (link.scope === "public") {
    return (
      <div style={shellStyle}>
        <div style={kind === "html" ? wideCardStyle : cardStyle}>
          <ShareViewer token={token} fileName={fileName} kind={kind} />
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
          <ShareViewer token={token} fileName={fileName} kind={kind} />
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

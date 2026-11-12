import "server-only";
import crypto from "node:crypto";

export function generateShareToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export type ShareScope = "email_otp" | "public";
export type SharePermission = "read" | "write";

/** A link is usable as long as it hasn't been revoked and (if it has an expiry) that date
 * hasn't passed yet -- the single place every access gate (view, OTP request/verify, raw GET,
 * raw POST) should check instead of re-deriving the same two conditions. */
export function isShareLinkUsable(link: { revoked: boolean; expiresAt: Date | null }): boolean {
  return !link.revoked && (!link.expiresAt || link.expiresAt > new Date());
}

export function generateOtpCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}${"*".repeat(Math.max(1, user.length - visible.length))}@${domain}`;
}

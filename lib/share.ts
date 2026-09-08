import "server-only";
import crypto from "node:crypto";

export function generateShareToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export type ShareScope = "email_otp" | "public";

export function generateOtpCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

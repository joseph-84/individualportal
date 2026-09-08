import "server-only";
import { SignJWT, jwtVerify } from "jose";

const ACCESS_TTL_SECONDS = 30 * 60; // 30 minutes per OTP verification

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET env var is not set");
  return new TextEncoder().encode(secret);
}

export function shareAccessCookieName(shareToken: string): string {
  return `so_${shareToken.slice(0, 20)}`;
}

export async function createShareAccessToken(shareToken: string): Promise<string> {
  return new SignJWT({ purpose: "share_otp", tk: shareToken })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifyShareAccessToken(jwt: string, shareToken: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(jwt, secretKey());
    return payload.purpose === "share_otp" && payload.tk === shareToken;
  } catch {
    return false;
  }
}

export const SHARE_ACCESS_MAX_AGE = ACCESS_TTL_SECONDS;

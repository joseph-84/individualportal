import "server-only";
import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { hashApiToken } from "./api-auth";
import { prisma } from "./prisma";
import type { CurrentUser } from "./session";

/** MCP OAuth 2.1 authorization server (claude.ai connector / mobile). Separate from the
 * existing static ApiToken bearer scheme (Claude Code/Desktop keep using that unchanged) and
 * from the portal's own login session (lib/auth.ts) -- a different signing key on purpose, so
 * a leaked/rotated key for one doesn't affect the other. Access tokens are short-lived signed
 * JWTs (stateless, matching /mcp's existing "no session state" design); only refresh tokens
 * are persisted (hashed, same technique as lib/api-auth.ts's hashApiToken) so they can be
 * revoked and rotated. */

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
const AUTH_CODE_TTL_SECONDS = 10 * 60; // 10 minutes

function oauthSecretKey() {
  const secret = process.env.MCP_OAUTH_SECRET;
  if (!secret) throw new Error("MCP_OAUTH_SECRET env var is not set");
  return new TextEncoder().encode(secret);
}

export interface AccessTokenPayload {
  sub: string; // userId
  clientId: string;
  resource: string;
}

/** `resource` (RFC 8707) is embedded as the JWT audience so a token minted for this MCP
 * server can't be replayed against a different resource. */
export async function createAccessToken({ sub, clientId, resource }: AccessTokenPayload): Promise<string> {
  return new SignJWT({ client_id: clientId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setAudience(resource)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(oauthSecretKey());
}

export async function verifyAccessToken(token: string, expectedResource: string): Promise<{ userId: string; clientId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, oauthSecretKey(), { audience: expectedResource });
    if (typeof payload.sub !== "string" || typeof payload.client_id !== "string") return null;
    return { userId: payload.sub, clientId: payload.client_id };
  } catch {
    return null;
  }
}

/** RFC 7636 PKCE, S256 only (plain is rejected by callers -- see app/oauth/authorize/page.tsx). */
export function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  const computed = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
  return computed === codeChallenge;
}

export function authCodeExpiresAt(): Date {
  return new Date(Date.now() + AUTH_CODE_TTL_SECONDS * 1000);
}

export function generateRefreshToken(): { token: string; hash: string } {
  const token = `mcprt_${crypto.randomBytes(32).toString("base64url")}`;
  return { token, hash: hashApiToken(token) };
}

export { hashApiToken as hashRefreshToken };

/** /mcp's second auth path, alongside the existing static-token lib/api-auth.ts#verifyApiToken
 * -- resolves an OAuth-issued access token (Authorization: Bearer <jwt>) to the user it was
 * minted for, scoped to `resource` (rejects a token minted for some other resource). */
export async function verifyOAuthBearerToken(authHeader: string | null, resource: string): Promise<CurrentUser | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const verified = await verifyAccessToken(token, resource);
  if (!verified) return null;

  const user = await prisma.user.findUnique({ where: { id: verified.userId } });
  if (!user || !user.active) return null;
  return { id: user.id, email: user.email, name: user.name, active: user.active };
}

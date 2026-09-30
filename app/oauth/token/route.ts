import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAccessToken, generateRefreshToken, hashRefreshToken, verifyPkce } from "@/lib/oauth";

export const dynamic = "force-dynamic";

function tokenError(error: string, description: string, status = 400) {
  return NextResponse.json({ error, error_description: description }, { status });
}

async function issueTokenPair(userId: string, clientId: string, resource: string) {
  const accessToken = await createAccessToken({ sub: userId, clientId, resource });
  const { token: refreshToken, hash } = generateRefreshToken();
  await prisma.oAuthRefreshToken.create({ data: { tokenHash: hash, clientId, userId, resource } });
  return NextResponse.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600,
    refresh_token: refreshToken,
    scope: "mcp",
  });
}

async function handleAuthorizationCode(form: FormData) {
  const code = String(form.get("code") || "");
  const redirectUri = String(form.get("redirect_uri") || "");
  const clientId = String(form.get("client_id") || "");
  const codeVerifier = String(form.get("code_verifier") || "");
  if (!code || !redirectUri || !clientId || !codeVerifier) {
    return tokenError("invalid_request", "code, redirect_uri, client_id, and code_verifier are all required.");
  }

  const authCode = await prisma.oAuthAuthorizationCode.findUnique({ where: { code } });
  if (!authCode || authCode.used || authCode.expiresAt < new Date()) {
    return tokenError("invalid_grant", "Authorization code is invalid, already used, or expired.");
  }
  if (authCode.clientId !== clientId || authCode.redirectUri !== redirectUri) {
    return tokenError("invalid_grant", "client_id or redirect_uri does not match the authorization request.");
  }
  if (!verifyPkce(codeVerifier, authCode.codeChallenge)) {
    return tokenError("invalid_grant", "code_verifier does not match the original code_challenge.");
  }

  // Single-use: atomically flip used=false -> true so a retried/replayed exchange can't double-mint.
  const claimed = await prisma.oAuthAuthorizationCode.updateMany({ where: { code, used: false }, data: { used: true } });
  if (claimed.count !== 1) {
    return tokenError("invalid_grant", "Authorization code was already used.");
  }

  return issueTokenPair(authCode.userId, authCode.clientId, authCode.resource);
}

async function handleRefreshToken(form: FormData) {
  const refreshToken = String(form.get("refresh_token") || "");
  const clientId = String(form.get("client_id") || "");
  if (!refreshToken || !clientId) {
    return tokenError("invalid_request", "refresh_token and client_id are required.");
  }

  const hash = hashRefreshToken(refreshToken);
  const stored = await prisma.oAuthRefreshToken.findUnique({ where: { tokenHash: hash } });
  if (!stored || stored.revoked || stored.clientId !== clientId) {
    return tokenError("invalid_grant", "Refresh token is invalid, revoked, or was issued to a different client.");
  }

  // Rotate: revoke the old one so a stolen-then-replayed refresh token is detectable (reuse
  // after rotation means someone else already has it -- same principle as revoking on use).
  await prisma.oAuthRefreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

  return issueTokenPair(stored.userId, stored.clientId, stored.resource);
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return tokenError("invalid_request", "Request body must be application/x-www-form-urlencoded.");
  }

  const grantType = String(form.get("grant_type") || "");
  if (grantType === "authorization_code") return handleAuthorizationCode(form);
  if (grantType === "refresh_token") return handleRefreshToken(form);
  return tokenError("unsupported_grant_type", "Only authorization_code and refresh_token grants are supported.");
}

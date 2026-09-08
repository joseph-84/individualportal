import "server-only";
import crypto from "node:crypto";
import { prisma } from "./prisma";
import type { CurrentUser } from "./session";

export function hashApiToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateApiToken(): { token: string; prefix: string } {
  const raw = crypto.randomBytes(32).toString("base64url");
  const token = `portal_${raw}`;
  return { token, prefix: token.slice(0, 14) };
}

/** Resolves an `Authorization: Bearer <token>` header to the owning user, exactly like
 * a cookie session. Single-user portal: no roles/permissions to resolve. */
export async function verifyApiToken(authHeader: string | null): Promise<CurrentUser | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const tokenHash = hashApiToken(token);
  const apiToken = await prisma.apiToken.findUnique({ where: { tokenHash } });
  if (!apiToken || apiToken.revoked) return null;

  const user = await prisma.user.findUnique({ where: { id: apiToken.userId } });
  if (!user || !user.active) return null;

  prisma.apiToken.update({ where: { id: apiToken.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return { id: user.id, email: user.email, name: user.name, active: user.active };
}

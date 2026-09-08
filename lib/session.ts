import "server-only";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { SESSION_COOKIE, verifySessionToken } from "./auth";

// Single-user portal: no roles/permissions. Any authenticated user has full access.
export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  active: boolean;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.active) return null;
  if (user.tokenVersion !== payload.tv) return null; // invalidated by password change / "다른 기기 모두 로그아웃"

  return { id: user.id, email: user.email, name: user.name, active: user.active };
}

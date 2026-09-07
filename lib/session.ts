import "server-only";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { SESSION_COOKIE, verifySessionToken } from "./auth";
import type { PageKey } from "./types";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  active: boolean;
  role: {
    id: string;
    key: string;
    name: string;
  };
  permissions: Record<string, number>;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { role: { include: { permissions: true } } },
  });
  if (!user || !user.active) return null;

  const permissions: Record<string, number> = {};
  for (const p of user.role.permissions) permissions[p.page] = p.level;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    active: user.active,
    role: { id: user.role.id, key: user.role.key, name: user.role.name },
    permissions,
  };
}

export function permLevelOf(user: CurrentUser, page: PageKey): 0 | 1 | 2 {
  return (user.permissions[page] ?? 0) as 0 | 1 | 2;
}

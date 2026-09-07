import "server-only";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getCurrentUser, permLevelOf, type CurrentUser } from "./session";
import type { PageKey } from "./types";

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return user;
}

export async function requirePerm(page: PageKey, minLevel: 1 | 2): Promise<CurrentUser> {
  const user = await requireUser();
  if (permLevelOf(user, page) < minLevel) {
    throw new Error(`권한이 없습니다: ${page} (요구 레벨 ${minLevel})`);
  }
  return user;
}

/** For page components: redirects to "/" if not logged in, otherwise returns the user and
 * their permission level for `page` without throwing — the page decides how to render level 0. */
export async function pageAccess(page: PageKey): Promise<{ user: CurrentUser; level: 0 | 1 | 2 }> {
  const user = await requireUser();
  return { user, level: permLevelOf(user, page) };
}

/** For API route handlers: never redirects, returns a 401/403 response instead. */
export async function apiRequirePerm(
  page: PageKey,
  minLevel: 1 | 2
): Promise<{ user: CurrentUser } | { error: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  if (permLevelOf(user, page) < minLevel) {
    return { error: NextResponse.json({ error: "권한이 없습니다." }, { status: 403 }) };
  }
  return { user };
}

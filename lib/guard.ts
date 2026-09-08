import "server-only";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getCurrentUser, type CurrentUser } from "./session";
import type { PageKey } from "./types";

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return user;
}

// Single-user portal: no per-page permission levels. Any logged-in user has full
// (read/write) access everywhere. `page`/`minLevel` are kept as parameters so call
// sites don't need to change; they're unused now.
export async function requirePerm(_page: PageKey, _minLevel: 1 | 2): Promise<CurrentUser> {
  return requireUser();
}

export async function pageAccess(_page: PageKey): Promise<{ user: CurrentUser; level: 0 | 1 | 2 }> {
  const user = await requireUser();
  return { user, level: 2 };
}

/** For API route handlers: never redirects, returns a 401 response instead. */
export async function apiRequirePerm(
  _page: PageKey,
  _minLevel: 1 | 2
): Promise<{ user: CurrentUser } | { error: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  return { user };
}

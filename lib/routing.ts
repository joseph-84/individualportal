import type { PageKey } from "./types";
import { UTILITY_PAGES } from "./constants";

const UTILITY_KEYS = new Set(UTILITY_PAGES.map((p) => p.key));

export function pathToPageKey(pathname: string): PageKey {
  const seg = pathname.replace(/^\//, "").split("/");
  if (seg[0] === "admin" || seg[0] === "utility") return (seg[1] as PageKey) ?? "dashboard";
  return (seg[0] as PageKey) || "dashboard";
}

export function pageKeyToPath(key: PageKey): string {
  if (key === "auditlog") return `/admin/${key}`;
  if (UTILITY_KEYS.has(key)) return `/utility/${key}`;
  return `/${key}`;
}

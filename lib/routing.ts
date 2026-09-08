import type { PageKey } from "./types";

export function pathToPageKey(pathname: string): PageKey {
  const seg = pathname.replace(/^\//, "").split("/");
  if (seg[0] === "admin") return (seg[1] as PageKey) ?? "dashboard";
  return (seg[0] as PageKey) || "dashboard";
}

export function pageKeyToPath(key: PageKey): string {
  if (key === "auditlog") return `/admin/${key}`;
  return `/${key}`;
}

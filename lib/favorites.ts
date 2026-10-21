import "server-only";
import { prisma } from "./prisma";

// Shared between app/actions/favorites.ts (the web UI's "use server" actions, which can only
// export async functions -- see lib/todo-status.ts for the same constraint) and the MCP
// create_favorite tool (lib/mcp/build-server.ts), so both paths normalize URLs and assign
// order the same way.

export function normalizeUrl(raw: string): string {
  const url = raw.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("/")) return url;
  return `https://${url}`;
}

export async function nextFavoriteOrder(folder: string): Promise<number> {
  const last = await prisma.favorite.findFirst({ where: { folder }, orderBy: { order: "desc" } });
  return (last?.order ?? 0) + 1000;
}

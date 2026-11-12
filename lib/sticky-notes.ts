import "server-only";
import { prisma } from "./prisma";

// Shared between app/actions/sticky-notes.ts (the web UI's "use server" actions) and the MCP
// create_note tool (lib/mcp/build-server.ts), so both paths place/color a new note the same way.

export const STICKY_COLORS = ["yellow", "pink", "blue", "green", "purple"] as const;
export type StickyColor = (typeof STICKY_COLORS)[number];

export async function nextStickyNoteZ(): Promise<number> {
  const last = await prisma.stickyNote.findFirst({ orderBy: { z: "desc" } });
  return (last?.z ?? 0) + 1;
}

/** Default spot for a newly created note: cascades diagonally so new notes don't land
 * exactly on top of existing ones, and cycles through the fixed color palette. */
export async function nextStickySpot(): Promise<{ x: number; y: number; color: StickyColor }> {
  const count = await prisma.stickyNote.count();
  return { x: 24 + (count % 6) * 36, y: 24 + (count % 6) * 36, color: STICKY_COLORS[count % STICKY_COLORS.length] };
}

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePerm } from "@/lib/guard";
import { writeAudit } from "@/lib/audit";
import { nextStickySpot, nextStickyNoteZ } from "@/lib/sticky-notes";

export async function createStickyNoteAction() {
  const user = await requirePerm("notes", 2);
  const { x, y, color } = await nextStickySpot();
  const z = await nextStickyNoteZ();
  const note = await prisma.stickyNote.create({ data: { x, y, z, color, ownerId: user.id } });
  await writeAudit(user, "note.create", "메모");
  revalidatePath("/notes");
  return note;
}

export async function updateStickyNoteContentAction(id: string, content: string) {
  await requirePerm("notes", 2);
  await prisma.stickyNote.update({ where: { id }, data: { content } });
  revalidatePath("/notes");
}

export async function setStickyNoteColorAction(id: string, color: string) {
  await requirePerm("notes", 2);
  await prisma.stickyNote.update({ where: { id }, data: { color } });
  revalidatePath("/notes");
}

export async function updateStickyNoteTitleAction(id: string, title: string) {
  await requirePerm("notes", 2);
  await prisma.stickyNote.update({ where: { id }, data: { title } });
  revalidatePath("/notes");
}

/** Resize-handle drag end: persists the dropped width/height (already clamped client-side). */
export async function resizeStickyNoteAction(id: string, width: number, height: number) {
  await requirePerm("notes", 2);
  await prisma.stickyNote.update({ where: { id }, data: { width, height } });
  revalidatePath("/notes");
}

export async function setStickyNoteCollapsedAction(id: string, collapsed: boolean) {
  await requirePerm("notes", 2);
  await prisma.stickyNote.update({ where: { id }, data: { collapsed } });
  revalidatePath("/notes");
}

/** Drag end: persists the dropped position and bumps the note to the front of the overlap
 * stack, the same "picking it up brings it to the top" behavior as a real sticky note. */
export async function moveStickyNoteAction(id: string, x: number, y: number) {
  await requirePerm("notes", 2);
  const z = await nextStickyNoteZ();
  await prisma.stickyNote.update({ where: { id }, data: { x, y, z } });
  revalidatePath("/notes");
}

export async function deleteStickyNoteAction(id: string) {
  const user = await requirePerm("notes", 2);
  const note = await prisma.stickyNote.findUniqueOrThrow({ where: { id } });
  await prisma.stickyNote.delete({ where: { id } });
  await writeAudit(user, "note.delete", note.content.slice(0, 30) || "(빈 메모)");
  revalidatePath("/notes");
}

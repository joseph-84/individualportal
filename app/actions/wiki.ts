"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePerm } from "@/lib/guard";

export async function saveNoteAction(id: string, content: string) {
  await requirePerm("wiki", 2);
  await prisma.note.update({ where: { id }, data: { content } });
  revalidatePath("/wiki");
}

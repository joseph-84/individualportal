"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePerm } from "@/lib/guard";
import { writeAudit } from "@/lib/audit";
import { toggleTaskItemChecked, resetAllTaskItemsChecked } from "@/lib/rich-text";

export async function saveChecklistAction(id: string, content: string) {
  await requirePerm("checklists", 2);
  await prisma.checklist.update({ where: { id }, data: { content } });
  revalidatePath("/checklists");
}

export interface CreateChecklistState {
  error?: string;
}

export async function createChecklistAction(_prev: CreateChecklistState, formData: FormData): Promise<CreateChecklistState> {
  const user = await requirePerm("checklists", 2);
  const title = String(formData.get("title") || "").trim();
  const folder = String(formData.get("folder") || "").trim();
  if (!title) return { error: "제목을 입력하세요." };

  const checklist = await prisma.checklist.create({
    data: { title, folder, content: "", ownerId: user.id },
  });
  await writeAudit(user, "checklist.create", title, { folder });
  revalidatePath("/checklists");
  redirect(`/checklists?id=${checklist.id}`);
}

export async function deleteChecklistAction(id: string) {
  const user = await requirePerm("checklists", 2);
  const checklist = await prisma.checklist.findUniqueOrThrow({ where: { id } });
  await prisma.checklist.delete({ where: { id } });
  await writeAudit(user, "checklist.delete", checklist.title);
  revalidatePath("/checklists");
  redirect("/checklists");
}

/** Toggles the Nth task-item checkbox (0-indexed, in document order) directly from the
 * read-only document view -- this is the whole point of the checklist page, so it must work
 * without opening the editor. No-op if there's no task item at that index. */
export async function toggleChecklistItemAction(id: string, checkboxIndex: number) {
  await requirePerm("checklists", 2);
  const checklist = await prisma.checklist.findUniqueOrThrow({ where: { id } });
  const updated = toggleTaskItemChecked(checklist.content, checkboxIndex);
  if (updated === checklist.content) return;
  await prisma.checklist.update({ where: { id }, data: { content: updated } });
  revalidatePath("/checklists");
}

/** Unchecks every item at once -- for a recurring checklist (shopping list, routine) you want
 * to reuse without manually unchecking each box or retyping the whole thing. */
export async function resetChecklistAction(id: string) {
  const user = await requirePerm("checklists", 2);
  const checklist = await prisma.checklist.findUniqueOrThrow({ where: { id } });
  const updated = resetAllTaskItemsChecked(checklist.content);
  if (updated === checklist.content) return;
  await prisma.checklist.update({ where: { id }, data: { content: updated } });
  await writeAudit(user, "checklist.reset", checklist.title);
  revalidatePath("/checklists");
}

/** Moves a checklist to a different folder path (drag-and-drop between existing folders/root,
 * or the sidebar's inline "폴더 이동" input for a brand-new path). `folder` is a plain string
 * that the sidebar treats as a "/"-delimited tree path client-side -- no schema change, same
 * virtual-folder convention as Note/Favorite (a folder only "exists" while something is in it). */
export async function moveChecklistAction(id: string, folder: string) {
  await requirePerm("checklists", 2);
  await prisma.checklist.update({ where: { id }, data: { folder } });
  revalidatePath("/checklists");
}

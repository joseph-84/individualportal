"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePerm } from "@/lib/guard";
import { writeAudit } from "@/lib/audit";

export async function saveNoteAction(id: string, content: string) {
  await requirePerm("wiki", 2);
  await prisma.note.update({ where: { id }, data: { content } });
  revalidatePath("/wiki");
}

export interface CreateNoteState {
  error?: string;
}

export async function createNoteAction(_prev: CreateNoteState, formData: FormData): Promise<CreateNoteState> {
  const user = await requirePerm("wiki", 2);
  const title = String(formData.get("title") || "").trim();
  const folder = String(formData.get("folder") || "").trim();
  const tagsRaw = String(formData.get("tags") || "").trim();
  const format = String(formData.get("format") || "md") === "html" ? "html" : "md";
  if (!title) return { error: "제목을 입력하세요." };

  const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];
  const content = format === "html" ? `<h1>${title}</h1>\n<p></p>\n` : `# ${title}\n\n`;
  const note = await prisma.note.create({
    data: { title, folder, tags, format, content, ownerId: user.id },
  });
  await writeAudit(user, "note.create", title, { folder, format });
  revalidatePath("/wiki");
  redirect(`/wiki?id=${note.id}`);
}

export async function deleteNoteAction(id: string) {
  const user = await requirePerm("wiki", 2);
  const note = await prisma.note.findUniqueOrThrow({ where: { id } });
  await prisma.note.delete({ where: { id } });
  await writeAudit(user, "note.delete", note.title);
  revalidatePath("/wiki");
  redirect("/wiki");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePerm } from "@/lib/guard";
import { writeAudit } from "@/lib/audit";
import { kbPathFor } from "@/lib/kb-files";

// Saving content, deleting, renaming, and moving an existing note all go through the unified
// /api/files POST endpoint now (it branches on isKbPath the same way it already does for
// read/render) so the file browser's buttons don't need to know whether a selected entry is a
// disk file or a KB note -- only creation stays here, since it needs structured fields
// (title/folder/tags/format) that don't fit the generic path-based write/delete/rename actions.
export interface CreateNoteState {
  error?: string;
}

export async function createNoteAction(_prev: CreateNoteState, formData: FormData): Promise<CreateNoteState> {
  const user = await requirePerm("files", 2);
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
  revalidatePath("/files");
  redirect(`/files?path=${encodeURIComponent(kbPathFor(note))}`);
}

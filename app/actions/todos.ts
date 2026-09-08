"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePerm } from "@/lib/guard";

export async function toggleTodoAction(id: string) {
  await requirePerm("todos", 2);
  const todo = await prisma.todo.findUniqueOrThrow({ where: { id } });
  await prisma.todo.update({ where: { id }, data: { done: !todo.done } });
  revalidatePath("/dashboard");
  revalidatePath("/todos");
}

export async function createTodoAction(formData: FormData) {
  const user = await requirePerm("todos", 2);
  const title = String(formData.get("title") || "").trim();
  if (!title) return;
  const dueRaw = String(formData.get("dueAt") || "");
  await prisma.todo.create({
    data: {
      title,
      project: String(formData.get("project") || "") || null,
      tag: String(formData.get("tag") || "업무"),
      repeat: String(formData.get("repeat") || "") || null,
      dueAt: dueRaw ? new Date(`${dueRaw}T09:00:00`) : null,
      ownerId: user.id,
    },
  });
  revalidatePath("/todos");
  revalidatePath("/dashboard");
}

export async function deleteTodoAction(id: string) {
  await requirePerm("todos", 2);
  await prisma.todo.delete({ where: { id } });
  revalidatePath("/todos");
  revalidatePath("/dashboard");
}

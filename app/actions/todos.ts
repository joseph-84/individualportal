"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePerm } from "@/lib/guard";

function parsePriority(v: FormDataEntryValue | null): number {
  const n = Number(v);
  return n === 1 || n === 3 ? n : 2;
}

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
  const parentId = String(formData.get("parentId") || "") || null;
  await prisma.todo.create({
    data: {
      title,
      description: String(formData.get("description") || "") || null,
      project: String(formData.get("project") || "") || null,
      tag: String(formData.get("tag") || "업무"),
      repeat: String(formData.get("repeat") || "") || null,
      dueAt: dueRaw ? new Date(`${dueRaw}T09:00:00`) : null,
      priority: parsePriority(formData.get("priority")),
      parentId,
      ownerId: user.id,
    },
  });
  revalidatePath("/todos");
  revalidatePath("/dashboard");
}

export interface EditTodoState {
  error?: string;
}

export async function editTodoAction(_prev: EditTodoState, formData: FormData): Promise<EditTodoState> {
  await requirePerm("todos", 2);
  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "").trim();
  if (!title) return { error: "제목을 입력하세요." };
  const dueRaw = String(formData.get("dueAt") || "");

  await prisma.todo.update({
    where: { id },
    data: {
      title,
      description: String(formData.get("description") || "") || null,
      project: String(formData.get("project") || "") || null,
      tag: String(formData.get("tag") || "업무"),
      repeat: String(formData.get("repeat") || "") || null,
      dueAt: dueRaw ? new Date(`${dueRaw}T09:00:00`) : null,
      priority: parsePriority(formData.get("priority")),
    },
  });
  revalidatePath("/todos");
  revalidatePath("/dashboard");
  return {};
}

export async function setTodoPriorityAction(id: string, priority: number) {
  await requirePerm("todos", 2);
  await prisma.todo.update({ where: { id }, data: { priority } });
  revalidatePath("/todos");
  revalidatePath("/dashboard");
}

export async function deleteTodoAction(id: string) {
  await requirePerm("todos", 2);
  await prisma.todo.delete({ where: { id } });
  revalidatePath("/todos");
  revalidatePath("/dashboard");
}

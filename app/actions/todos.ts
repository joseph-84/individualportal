"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePerm } from "@/lib/guard";

export const TODO_STATUSES = ["todo", "in_progress", "done"] as const;
export type TodoStatus = (typeof TODO_STATUSES)[number];

function isTodoStatus(v: string): v is TodoStatus {
  return (TODO_STATUSES as readonly string[]).includes(v);
}

async function nextOrder(parentId: string | null): Promise<number> {
  const last = await prisma.todo.findFirst({ where: { parentId }, orderBy: { order: "desc" } });
  return (last?.order ?? 0) + 1000;
}

/** Quick checkbox toggle: flips between "done" and "todo" (used by the list/dashboard
 * checkbox). Use updateTodoStatusAction/moveTodoAction for the full 3-state status. */
export async function toggleTodoAction(id: string) {
  await requirePerm("todos", 2);
  const todo = await prisma.todo.findUniqueOrThrow({ where: { id } });
  await prisma.todo.update({ where: { id }, data: { status: todo.status === "done" ? "todo" : "done" } });
  revalidatePath("/dashboard");
  revalidatePath("/todos");
}

export async function createTodoAction(formData: FormData) {
  const user = await requirePerm("todos", 2);
  const title = String(formData.get("title") || "").trim();
  if (!title) return;
  const dueRaw = String(formData.get("dueAt") || "");
  const parentId = String(formData.get("parentId") || "") || null;
  const statusRaw = String(formData.get("status") || "todo");
  const order = await nextOrder(parentId);
  await prisma.todo.create({
    data: {
      title,
      description: String(formData.get("description") || "") || null,
      project: String(formData.get("project") || "") || null,
      tag: String(formData.get("tag") || "업무"),
      repeat: String(formData.get("repeat") || "") || null,
      dueAt: dueRaw ? new Date(`${dueRaw}T09:00:00`) : null,
      status: isTodoStatus(statusRaw) ? statusRaw : "todo",
      order,
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
  const statusRaw = String(formData.get("status") || "todo");

  await prisma.todo.update({
    where: { id },
    data: {
      title,
      description: String(formData.get("description") || "") || null,
      project: String(formData.get("project") || "") || null,
      tag: String(formData.get("tag") || "업무"),
      repeat: String(formData.get("repeat") || "") || null,
      dueAt: dueRaw ? new Date(`${dueRaw}T09:00:00`) : null,
      status: isTodoStatus(statusRaw) ? statusRaw : "todo",
    },
  });
  revalidatePath("/todos");
  revalidatePath("/dashboard");
  return {};
}

/** Drag-and-drop reorder within the same sibling group (same parentId), status unchanged.
 * `beforeOrder`/`afterOrder` are the order values of the two rows the item was dropped
 * between (either may be omitted at the start/end of the list); the new order is the midpoint. */
export async function reorderTodoAction(id: string, beforeOrder: number | null, afterOrder: number | null) {
  await requirePerm("todos", 2);
  let newOrder: number;
  if (beforeOrder !== null && afterOrder !== null) newOrder = (beforeOrder + afterOrder) / 2;
  else if (beforeOrder !== null) newOrder = beforeOrder + 1000;
  else if (afterOrder !== null) newOrder = afterOrder - 1000;
  else newOrder = 1000;
  await prisma.todo.update({ where: { id }, data: { order: newOrder } });
  revalidatePath("/todos");
  revalidatePath("/dashboard");
}

/** Sets the exact status (e.g. from an edit form dropdown), without touching order. */
export async function updateTodoStatusAction(id: string, status: string) {
  await requirePerm("todos", 2);
  if (!isTodoStatus(status)) return;
  await prisma.todo.update({ where: { id }, data: { status } });
  revalidatePath("/todos");
  revalidatePath("/dashboard");
}

/** Kanban drag-and-drop: moves a card into `status`'s column, positioned between the two
 * given order values (same midpoint scheme as reorderTodoAction). */
export async function moveTodoAction(id: string, status: string, beforeOrder: number | null, afterOrder: number | null) {
  await requirePerm("todos", 2);
  if (!isTodoStatus(status)) return;
  let newOrder: number;
  if (beforeOrder !== null && afterOrder !== null) newOrder = (beforeOrder + afterOrder) / 2;
  else if (beforeOrder !== null) newOrder = beforeOrder + 1000;
  else if (afterOrder !== null) newOrder = afterOrder - 1000;
  else newOrder = 1000;
  await prisma.todo.update({ where: { id }, data: { status, order: newOrder } });
  revalidatePath("/todos");
  revalidatePath("/dashboard");
}

export async function deleteTodoAction(id: string) {
  await requirePerm("todos", 2);
  await prisma.todo.delete({ where: { id } });
  revalidatePath("/todos");
  revalidatePath("/dashboard");
}

// Kept out of app/actions/todos.ts ("use server") because Next.js requires a "use server"
// file to export ONLY async functions — exporting this const/type from that file compiles
// fine but throws at runtime the first time the module is evaluated ("A 'use server' file can
// only export async functions, found object"), breaking every action in that file.
import { prisma } from "@/lib/prisma";

export const TODO_STATUSES = ["todo", "in_progress", "done"] as const;
export type TodoStatus = (typeof TODO_STATUSES)[number];

export function isTodoStatus(v: string): v is TodoStatus {
  return (TODO_STATUSES as readonly string[]).includes(v);
}

/** Computes the completedAt value for a status transition: cleared when leaving "done", set to
 * now when newly entering "done", left untouched when already "done" and staying that way (so
 * unrelated edits to an already-completed todo don't keep bumping its completion time and
 * postponing when it becomes eligible to auto-hide). Also non-async-export-only reasons as
 * above: the web actions (app/actions/todos.ts) and the MCP `update_todo` tool
 * (lib/mcp/build-server.ts) both need this, and only one of those is a "use server" file. */
export function nextCompletedAt(nextStatus: string, prevStatus: string, prevCompletedAt: Date | null): Date | null {
  if (nextStatus !== "done") return null;
  return prevStatus === "done" ? prevCompletedAt : new Date();
}

/** After a todo's status changes, auto-complete its parent (and grandparent, ...) once every
 * sibling under it is "done" -- one-directional (forward) only: un-completing a child later
 * does not auto-revert a parent that was already auto-completed, the user can cycle it back
 * manually (web UI's TodoStatusToggle, or another update_todo call) same as any other status
 * change. Shared by both the web actions and the MCP update_todo tool. */
export async function cascadeParentCompletion(todoId: string): Promise<void> {
  const todo = await prisma.todo.findUnique({ where: { id: todoId } });
  if (!todo?.parentId) return;
  const siblings = await prisma.todo.findMany({ where: { parentId: todo.parentId } });
  if (siblings.length === 0 || !siblings.every((s) => s.status === "done")) return;
  const parent = await prisma.todo.findUnique({ where: { id: todo.parentId } });
  if (!parent || parent.status === "done") return;
  await prisma.todo.update({ where: { id: parent.id }, data: { status: "done", completedAt: new Date() } });
  await cascadeParentCompletion(parent.id);
}

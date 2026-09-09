// Kept out of app/actions/todos.ts ("use server") because Next.js requires a "use server"
// file to export ONLY async functions — exporting this const/type from that file compiles
// fine but throws at runtime the first time the module is evaluated ("A 'use server' file can
// only export async functions, found object"), breaking every action in that file.
export const TODO_STATUSES = ["todo", "in_progress", "done"] as const;
export type TodoStatus = (typeof TODO_STATUSES)[number];

export function isTodoStatus(v: string): v is TodoStatus {
  return (TODO_STATUSES as readonly string[]).includes(v);
}

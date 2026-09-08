import { pageAccess } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { listGoogleEvents } from "@/lib/google-calendar";
import { TodosClient } from "@/components/TodosClient";

export default async function TodosPage() {
  const { user, level } = await pageAccess("todos");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [todos, googleEvents] = await Promise.all([
    prisma.todo.findMany({ orderBy: { order: "asc" } }),
    listGoogleEvents(monthStart.toISOString(), monthEnd.toISOString()),
  ]);

  return (
    <TodosClient
      canWrite={level === 2}
      googleEvents={googleEvents}
      todos={todos.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        project: t.project,
        repeat: t.repeat,
        tag: t.tag || "개인",
        done: t.done,
        order: t.order,
        parentId: t.parentId,
        dueAt: t.dueAt ? t.dueAt.toISOString() : null,
      }))}
    />
  );
}

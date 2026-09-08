import { pageAccess } from "@/lib/guard";
import { Denied } from "@/components/Denied";
import { prisma } from "@/lib/prisma";
import { TodosClient } from "@/components/TodosClient";

export default async function TodosPage() {
  const { user, level } = await pageAccess("todos");
  if (level === 0) return <Denied roleName={user.role.name} />;

  const todos = await prisma.todo.findMany({ orderBy: [{ priority: "asc" }, { createdAt: "asc" }] });

  return (
    <TodosClient
      canWrite={level === 2}
      todos={todos.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        project: t.project,
        repeat: t.repeat,
        tag: t.tag || "개인",
        done: t.done,
        priority: t.priority,
        parentId: t.parentId,
        dueAt: t.dueAt ? t.dueAt.toISOString() : null,
      }))}
    />
  );
}

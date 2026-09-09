"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";

export interface NotificationItem {
  id: string;
  label: string;
  href: string;
}

export async function getNotificationsAction(): Promise<NotificationItem[]> {
  await requireUser();
  const items: NotificationItem[] = [];

  const overdue = await prisma.todo.findMany({
    where: { status: { not: "done" }, dueAt: { lt: new Date() } },
    orderBy: { dueAt: "asc" },
    take: 5,
  });
  for (const t of overdue) items.push({ id: `todo-${t.id}`, label: `마감 지남: ${t.title}`, href: "/todos" });

  const failed = await prisma.scriptRun.findMany({
    where: { status: "err", startedAt: { gte: new Date(Date.now() - 24 * 3600_000) } },
    orderBy: { startedAt: "desc" },
    take: 5,
    include: { script: true },
  });
  for (const r of failed) items.push({ id: `run-${r.id}`, label: `실행 실패: ${r.script.file}`, href: "/automation" });

  return items;
}

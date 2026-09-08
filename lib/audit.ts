import "server-only";
import { prisma } from "./prisma";
import type { CurrentUser } from "./session";

export async function writeAudit(actor: CurrentUser, action: string, target: string, meta?: Record<string, unknown>) {
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      actorName: actor.name,
      action,
      target,
      meta: meta ? JSON.stringify(meta) : null,
    },
  });
}

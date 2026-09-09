"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { generateShareToken, type ShareScope } from "@/lib/share";
import { writeAudit } from "@/lib/audit";

export async function listShareLinksAction(relPath: string) {
  await requireUser();
  return prisma.shareLink.findMany({ where: { relPath, revoked: false }, orderBy: { createdAt: "desc" } });
}

export interface CreateShareState {
  error?: string;
  token?: string;
}

export async function createShareLinkAction(relPath: string, scope: ShareScope, email?: string): Promise<CreateShareState> {
  const user = await requireUser();
  if (scope !== "email_otp" && scope !== "public") return { error: "잘못된 공개 범위입니다." };
  if (scope === "email_otp") {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "올바른 이메일 주소를 입력하세요." };
  }

  const token = generateShareToken();
  await prisma.shareLink.create({
    data: { token, relPath, scope, email: scope === "email_otp" ? email : null, createdById: user.id },
  });
  await writeAudit(user, "file.share", relPath, { scope, email: scope === "email_otp" ? email : undefined });
  revalidatePath("/files");
  return { token };
}

export async function revokeShareLinkAction(id: string) {
  const user = await requireUser();
  const link = await prisma.shareLink.update({ where: { id }, data: { revoked: true } });
  await writeAudit(user, "file.unshare", link.relPath);
  revalidatePath("/files");
}

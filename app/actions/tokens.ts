"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { generateApiToken, hashApiToken } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";

export async function listApiTokensAction() {
  const user = await requireUser();
  return prisma.apiToken.findMany({
    where: { userId: user.id, revoked: false },
    orderBy: { createdAt: "desc" },
  });
}

export interface CreateTokenState {
  error?: string;
  token?: string;
}

export async function createApiTokenAction(_prev: CreateTokenState, formData: FormData): Promise<CreateTokenState> {
  const user = await requireUser();
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "토큰 이름을 입력하세요." };

  const { token, prefix } = generateApiToken();
  await prisma.apiToken.create({
    data: { name, tokenHash: hashApiToken(token), tokenPrefix: prefix, userId: user.id },
  });
  await writeAudit(user, "token.create", name);
  revalidatePath("/account");
  return { token };
}

export async function revokeApiTokenAction(id: string) {
  const user = await requireUser();
  const token = await prisma.apiToken.findUniqueOrThrow({ where: { id } });
  if (token.userId !== user.id) throw new Error("본인 토큰만 취소할 수 있습니다.");
  await prisma.apiToken.update({ where: { id }, data: { revoked: true } });
  await writeAudit(user, "token.revoke", token.name);
  revalidatePath("/account");
}

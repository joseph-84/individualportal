"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePerm } from "@/lib/guard";
import { hashPassword } from "@/lib/auth";

export async function toggleUserActiveAction(id: string) {
  await requirePerm("users", 2);
  const user = await prisma.user.findUniqueOrThrow({ where: { id } });
  await prisma.user.update({ where: { id }, data: { active: !user.active } });
  revalidatePath("/admin/users");
}

export interface CreateUserState {
  error?: string;
}

export async function createUserAction(_prev: CreateUserState, formData: FormData): Promise<CreateUserState> {
  await requirePerm("users", 2);
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  const roleKey = String(formData.get("role") || "");
  const password = String(formData.get("password") || "");

  if (!email || !name || !roleKey || !password) {
    return { error: "모든 필드를 입력하세요." };
  }
  if (password.length < 8) {
    return { error: "비밀번호는 8자 이상이어야 합니다." };
  }

  const role = await prisma.role.findUnique({ where: { key: roleKey } });
  if (!role) return { error: "존재하지 않는 역할입니다." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "이미 등록된 이메일입니다." };

  await prisma.user.create({
    data: {
      email,
      name,
      roleId: role.id,
      passwordHash: await hashPassword(password),
    },
  });

  revalidatePath("/admin/users");
  return {};
}

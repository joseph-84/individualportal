"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePerm } from "@/lib/guard";
import { hashPassword } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export async function toggleUserActiveAction(id: string) {
  const actor = await requirePerm("users", 2);
  if (id === actor.id) throw new Error("본인 계정은 비활성화할 수 없습니다.");

  const user = await prisma.user.findUniqueOrThrow({ where: { id }, include: { role: true } });
  const nextActive = !user.active;

  if (!nextActive && user.role.key === "admin") {
    const activeAdmins = await prisma.user.count({ where: { active: true, role: { key: "admin" } } });
    if (activeAdmins <= 1) throw new Error("마지막 남은 활성 관리자는 비활성화할 수 없습니다.");
  }

  await prisma.user.update({ where: { id }, data: { active: nextActive } });
  await writeAudit(actor, "user.toggle", user.email, { active: nextActive });
  revalidatePath("/admin/users");
}

export interface CreateUserState {
  error?: string;
}

export async function createUserAction(_prev: CreateUserState, formData: FormData): Promise<CreateUserState> {
  const actor = await requirePerm("users", 2);
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

  await writeAudit(actor, "user.create", email, { role: roleKey });
  revalidatePath("/admin/users");
  return {};
}

export interface EditUserState {
  error?: string;
  success?: boolean;
}

export async function editUserAction(_prev: EditUserState, formData: FormData): Promise<EditUserState> {
  const actor = await requirePerm("users", 2);
  const id = String(formData.get("id") || "");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  const roleKey = String(formData.get("role") || "");

  if (!email || !name || !roleKey) return { error: "모든 필드를 입력하세요." };

  const role = await prisma.role.findUnique({ where: { key: roleKey } });
  if (!role) return { error: "존재하지 않는 역할입니다." };

  const conflict = await prisma.user.findUnique({ where: { email } });
  if (conflict && conflict.id !== id) return { error: "이미 다른 계정이 사용 중인 이메일입니다." };

  await prisma.user.update({ where: { id }, data: { email, name, roleId: role.id } });
  await writeAudit(actor, "user.update", email, { role: roleKey });
  revalidatePath("/admin/users");
  return { success: true };
}

export interface ResetPasswordState {
  error?: string;
  tempPassword?: string;
}

function randomPassword() {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6).toUpperCase();
}

export async function resetUserPasswordAction(id: string): Promise<ResetPasswordState> {
  const actor = await requirePerm("users", 2);
  const temp = randomPassword();
  const user = await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(temp), tokenVersion: { increment: 1 }, failedLoginCount: 0, lockedUntil: null },
  });
  await writeAudit(actor, "user.reset_password", user.email);
  revalidatePath("/admin/users");
  return { tempPassword: temp };
}

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePerm } from "@/lib/guard";
import { PAGES } from "@/lib/constants";

export interface PermChange {
  roleId: string;
  page: string;
  level: number;
}

export async function savePermissionsAction(changes: PermChange[]) {
  await requirePerm("roles", 2);
  await prisma.$transaction(
    changes.map((c) =>
      prisma.pagePermission.upsert({
        where: { roleId_page: { roleId: c.roleId, page: c.page } },
        update: { level: c.level },
        create: { roleId: c.roleId, page: c.page, level: c.level },
      })
    )
  );
  revalidatePath("/admin/roles");
  revalidatePath("/", "layout");
}

export interface CreateRoleState {
  error?: string;
}

export async function createRoleAction(_prev: CreateRoleState, formData: FormData): Promise<CreateRoleState> {
  await requirePerm("roles", 2);
  const key = String(formData.get("key") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();

  if (!/^[a-z0-9_-]{2,24}$/.test(key)) {
    return { error: "역할 키는 영문 소문자/숫자/-/_ 2~24자여야 합니다." };
  }
  if (!name) return { error: "역할 이름을 입력하세요." };

  const existing = await prisma.role.findUnique({ where: { key } });
  if (existing) return { error: "이미 존재하는 역할 키입니다." };

  const role = await prisma.role.create({ data: { key, name, description } });
  await prisma.pagePermission.createMany({
    data: PAGES.map((p) => ({ roleId: role.id, page: p.key, level: 0 })),
  });

  revalidatePath("/admin/roles");
  return {};
}

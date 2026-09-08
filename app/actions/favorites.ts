"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePerm } from "@/lib/guard";
import { writeAudit } from "@/lib/audit";

function normalizeUrl(raw: string): string {
  const url = raw.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("/")) return url;
  return `https://${url}`;
}

export interface FavoriteFormState {
  error?: string;
}

export async function createFavoriteAction(_prev: FavoriteFormState, formData: FormData): Promise<FavoriteFormState> {
  const user = await requirePerm("favorites", 2);
  const title = String(formData.get("title") || "").trim();
  const urlRaw = String(formData.get("url") || "").trim();
  const folder = String(formData.get("folder") || "").trim();
  if (!title) return { error: "제목을 입력하세요." };
  if (!urlRaw) return { error: "URL을 입력하세요." };

  const favorite = await prisma.favorite.create({ data: { title, url: normalizeUrl(urlRaw), folder, ownerId: user.id } });
  await writeAudit(user, "favorite.create", title, { folder });
  revalidatePath("/favorites");
  return {};
}

export async function editFavoriteAction(_prev: FavoriteFormState, formData: FormData): Promise<FavoriteFormState> {
  const user = await requirePerm("favorites", 2);
  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "").trim();
  const urlRaw = String(formData.get("url") || "").trim();
  const folder = String(formData.get("folder") || "").trim();
  if (!title) return { error: "제목을 입력하세요." };
  if (!urlRaw) return { error: "URL을 입력하세요." };

  await prisma.favorite.update({ where: { id }, data: { title, url: normalizeUrl(urlRaw), folder } });
  await writeAudit(user, "favorite.update", title, { folder });
  revalidatePath("/favorites");
  return {};
}

export async function deleteFavoriteAction(id: string) {
  const user = await requirePerm("favorites", 2);
  const favorite = await prisma.favorite.findUniqueOrThrow({ where: { id } });
  await prisma.favorite.delete({ where: { id } });
  await writeAudit(user, "favorite.delete", favorite.title);
  revalidatePath("/favorites");
}

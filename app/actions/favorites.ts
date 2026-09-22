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

async function nextOrder(folder: string): Promise<number> {
  const last = await prisma.favorite.findFirst({ where: { folder }, orderBy: { order: "desc" } });
  return (last?.order ?? 0) + 1000;
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

  const order = await nextOrder(folder);
  const favorite = await prisma.favorite.create({ data: { title, url: normalizeUrl(urlRaw), folder, order, ownerId: user.id } });
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

/** Drag-and-drop reposition, mirroring Todo's moveTodoAction: `folder` may be the item's
 * current folder (pure reorder) or a different one (moves it there too), positioned between
 * the two given order values (midpoint scheme; either may be omitted at the start/end). */
export async function moveFavoriteAction(id: string, folder: string, beforeOrder: number | null, afterOrder: number | null) {
  await requirePerm("favorites", 2);
  let newOrder: number;
  if (beforeOrder !== null && afterOrder !== null) newOrder = (beforeOrder + afterOrder) / 2;
  else if (beforeOrder !== null) newOrder = beforeOrder + 1000;
  else if (afterOrder !== null) newOrder = afterOrder - 1000;
  else newOrder = 1000;
  await prisma.favorite.update({ where: { id }, data: { folder, order: newOrder } });
  revalidatePath("/favorites");
}

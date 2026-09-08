import { pageAccess } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { FavoritesClient } from "@/components/FavoritesClient";

export default async function FavoritesPage() {
  const { level } = await pageAccess("favorites");

  const favorites = await prisma.favorite.findMany({ orderBy: [{ folder: "asc" }, { title: "asc" }] });

  return (
    <FavoritesClient
      canWrite={level === 2}
      favorites={favorites.map((f) => ({ id: f.id, title: f.title, url: f.url, folder: f.folder }))}
    />
  );
}

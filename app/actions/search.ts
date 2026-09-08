"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { permLevelOf } from "@/lib/session";
import { listDir } from "@/lib/files";

export interface SearchResult {
  kind: "todo" | "note" | "file";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export async function searchAction(query: string): Promise<SearchResult[]> {
  const user = await requireUser();
  const q = query.trim();
  if (q.length < 2) return [];

  const results: SearchResult[] = [];

  if (permLevelOf(user, "todos") > 0) {
    const todos = await prisma.todo.findMany({
      where: { title: { contains: q, mode: "insensitive" } },
      take: 5,
    });
    for (const t of todos) results.push({ kind: "todo", id: t.id, title: t.title, subtitle: t.project || "할일", href: "/todos" });
  }

  if (permLevelOf(user, "wiki") > 0) {
    const notes = await prisma.note.findMany({
      where: { OR: [{ title: { contains: q, mode: "insensitive" } }, { content: { contains: q, mode: "insensitive" } }] },
      take: 5,
    });
    for (const n of notes) results.push({ kind: "note", id: n.id, title: n.title, subtitle: n.folder || "위키", href: `/wiki?id=${n.id}` });
  }

  if (permLevelOf(user, "files") > 0) {
    try {
      const walk = async (dir: string, depth: number): Promise<void> => {
        if (depth > 3 || results.filter((r) => r.kind === "file").length >= 5) return;
        const entries = await listDir(dir);
        for (const e of entries) {
          if (results.filter((r) => r.kind === "file").length >= 5) return;
          if (e.name.toLowerCase().includes(q.toLowerCase())) {
            results.push({ kind: "file", id: e.relPath, title: e.name, subtitle: e.relPath, href: "/files" });
          }
          if (e.isDir) await walk(e.relPath, depth + 1);
        }
      };
      await walk("", 0);
    } catch {
      // ignore fs errors during search
    }
  }

  return results;
}

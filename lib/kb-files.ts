import "server-only";
import { prisma } from "./prisma";
import type { FileEntry } from "./files";

export const KB_ROOT = "__kb__";
const UNFILED = "(미분류)";

function encodeSeg(s: string) {
  return encodeURIComponent(s);
}
function decodeSeg(s: string) {
  return decodeURIComponent(s);
}

export function isKbPath(relPath: string): boolean {
  return relPath === KB_ROOT || relPath.startsWith(KB_ROOT + "/");
}

export const kbRootEntry: FileEntry = {
  name: "지식베이스",
  relPath: KB_ROOT,
  isDir: true,
  size: 0,
  mtime: new Date(0).toISOString(),
  ext: "",
};

export async function listKbEntries(dir: string): Promise<FileEntry[]> {
  if (dir === KB_ROOT) {
    const notes = await prisma.note.findMany({ select: { folder: true } });
    const folders = Array.from(new Set(notes.map((n) => n.folder || UNFILED))).sort();
    return folders.map((f) => ({
      name: f,
      relPath: `${KB_ROOT}/${encodeSeg(f)}`,
      isDir: true,
      size: 0,
      mtime: new Date(0).toISOString(),
      ext: "",
    }));
  }

  const segs = dir.slice(KB_ROOT.length + 1).split("/");
  if (segs.length === 1) {
    const folderName = decodeSeg(segs[0]);
    const notes = await prisma.note.findMany({
      where: { folder: folderName === UNFILED ? "" : folderName },
      orderBy: { title: "asc" },
    });
    return notes.map((n) => ({
      name: `${n.title}.${n.format}`,
      relPath: `${dir}/${encodeSeg(n.title)}.${n.format}`,
      isDir: false,
      size: n.content.length,
      mtime: n.updatedAt.toISOString(),
      ext: n.format.toUpperCase(),
    }));
  }

  return [];
}

export interface KbFileRef {
  note: Awaited<ReturnType<typeof prisma.note.findFirst>>;
}

/** Resolves a `__kb__/<folder>/<title>.<ext>` path to its Note row. */
export async function resolveKbNote(relPath: string) {
  if (!isKbPath(relPath) || relPath === KB_ROOT) return null;
  const segs = relPath.slice(KB_ROOT.length + 1).split("/");
  if (segs.length !== 2) return null;
  const folderName = decodeSeg(segs[0]);
  const fileName = decodeSeg(segs[1]);
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return null;
  const title = fileName.slice(0, dot);
  const format = fileName.slice(dot + 1);
  return prisma.note.findFirst({
    where: { title, format, folder: folderName === UNFILED ? "" : folderName },
  });
}

import "server-only";
import { prisma } from "./prisma";
import { UnsafePathError, type FileEntry } from "./files";

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
      tags: n.tags,
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

/** Inverse of resolveKbNote -- the virtual path a note currently lives at, used to deep-link
 * into the unified file browser (search results, dashboard "최근 노트") instead of the removed
 * /wiki?id= route. */
export function kbPathFor(note: { title: string; folder: string; format: string }): string {
  return `${KB_ROOT}/${encodeSeg(note.folder || UNFILED)}/${encodeSeg(note.title)}.${note.format}`;
}

/** Renames and/or moves a note by reinterpreting it as a path rename, the same operation
 * disk files get via renameOrMoveEntry -- lets the file browser's single "이름변경"/"이동" UI
 * and the rename_file MCP tool treat KB entries and disk files identically. The extension
 * (note format) can't change this way since there's no content-conversion story for it. */
export async function renameOrMoveKbNote(fromRelPath: string, toRelPath: string): Promise<void> {
  const note = await resolveKbNote(fromRelPath);
  if (!note) throw new UnsafePathError("문서를 찾을 수 없습니다.");
  if (!isKbPath(toRelPath) || toRelPath === KB_ROOT) throw new UnsafePathError("지식베이스 내부 경로로만 이동할 수 있습니다.");

  const segs = toRelPath.slice(KB_ROOT.length + 1).split("/");
  if (segs.length !== 2) throw new UnsafePathError("잘못된 경로입니다.");
  const folderName = decodeSeg(segs[0]);
  const fileName = decodeSeg(segs[1]);
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) throw new UnsafePathError("잘못된 경로입니다.");
  const title = fileName.slice(0, dot);
  const format = fileName.slice(dot + 1);
  if (format !== note.format) throw new UnsafePathError("문서 형식(확장자)은 변경할 수 없습니다.");

  await prisma.note.update({
    where: { id: note.id },
    data: { title, folder: folderName === UNFILED ? "" : folderName },
  });
}

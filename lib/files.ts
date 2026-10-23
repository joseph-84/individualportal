import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

export const SYNC_ROOT = path.resolve(process.env.SYNC_FOLDER_PATH || "./data-mount");

export class UnsafePathError extends Error {}

export function resolveSafePath(relPath: string): string {
  const cleaned = (relPath || "").replace(/^\/+/, "");
  const full = path.resolve(SYNC_ROOT, cleaned);
  if (full !== SYNC_ROOT && !full.startsWith(SYNC_ROOT + path.sep)) {
    throw new UnsafePathError("경로가 허용된 폴더를 벗어났습니다.");
  }
  return full;
}

export interface FileEntry {
  name: string;
  relPath: string;
  isDir: boolean;
  size: number;
  mtime: string;
  ext: string;
}

export async function listDir(relPath: string): Promise<FileEntry[]> {
  const full = resolveSafePath(relPath);
  const entries = await fs.readdir(full, { withFileTypes: true });
  const result: FileEntry[] = [];
  for (const e of entries) {
    const entryRel = path.posix.join(relPath, e.name);
    const stat = await fs.stat(path.join(full, e.name));
    result.push({
      name: e.name,
      relPath: entryRel,
      isDir: e.isDirectory(),
      size: stat.size,
      mtime: stat.mtime.toISOString(),
      ext: e.isDirectory() ? "" : path.extname(e.name).replace(".", "").toUpperCase(),
    });
  }
  result.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
  return result;
}

const TEXT_EXT = new Set(["TXT", "CSV", "LOG", "JSON", "YML", "YAML", "TS", "JS", "PY", "SH"]);
const IMAGE_EXT = new Set(["PNG", "JPG", "JPEG", "GIF", "WEBP", "SVG"]);

export function previewKind(ext: string): "text" | "image" | "pdf" | "html" | "binary" {
  // "html" here means "rendered document view", not literally an .html file -- markdown gets
  // rendered to HTML the same way (see /share/[token]/raw) instead of shown as raw source.
  if (ext === "HTML" || ext === "MD") return "html";
  if (TEXT_EXT.has(ext)) return "text";
  if (IMAGE_EXT.has(ext)) return "image";
  if (ext === "PDF") return "pdf";
  return "binary";
}

export async function readFileBuffer(relPath: string): Promise<Buffer> {
  const full = resolveSafePath(relPath);
  return fs.readFile(full);
}

export async function ensureDir(relPath: string) {
  const full = resolveSafePath(relPath);
  await fs.mkdir(full, { recursive: true });
}

export async function writeFile(relPath: string, data: Buffer) {
  const full = resolveSafePath(relPath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
}

export async function recentFiles(limit = 8, maxDepth = 3): Promise<FileEntry[]> {
  const all: FileEntry[] = [];
  async function walk(rel: string, depth: number) {
    if (depth > maxDepth) return;
    let entries: FileEntry[];
    try {
      entries = await listDir(rel);
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDir) await walk(e.relPath, depth + 1);
      else all.push(e);
    }
  }
  await walk("", 0);
  all.sort((a, b) => (a.mtime < b.mtime ? 1 : -1));
  return all.slice(0, limit);
}

export async function deleteEntry(relPath: string): Promise<void> {
  if (!relPath) throw new UnsafePathError("루트 폴더는 삭제할 수 없습니다.");
  const full = resolveSafePath(relPath);
  await fs.rm(full, { recursive: true, force: true });
}

export async function renameOrMoveEntry(fromRelPath: string, toRelPath: string): Promise<void> {
  const fromFull = resolveSafePath(fromRelPath);
  const toFull = resolveSafePath(toRelPath);
  await fs.mkdir(path.dirname(toFull), { recursive: true });
  await fs.rename(fromFull, toFull);
}

/** Copies a file or directory (recursively) to a new location, leaving the original in place. */
export async function copyEntry(fromRelPath: string, toRelPath: string): Promise<void> {
  const fromFull = resolveSafePath(fromRelPath);
  const toFull = resolveSafePath(toRelPath);
  await fs.mkdir(path.dirname(toFull), { recursive: true });
  // errorOnExist only takes effect when force is also false -- otherwise fs.cp defaults to
  // silently overwriting the destination.
  await fs.cp(fromFull, toFull, { recursive: true, force: false, errorOnExist: true });
}

export async function diskUsage(): Promise<{ used: number }> {
  let used = 0;
  async function walk(rel: string, depth: number) {
    if (depth > 6) return;
    let entries: FileEntry[];
    try {
      entries = await listDir(rel);
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDir) await walk(e.relPath, depth + 1);
      else used += e.size;
    }
  }
  await walk("", 0);
  return { used };
}

import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

export const SCRIPTS_ROOT = path.resolve(process.env.SCRIPTS_PATH || "./data-scripts");

export class UnsafeScriptPathError extends Error {}

function resolveScriptPath(file: string): string {
  if (file.includes("/") || file.includes("..")) throw new UnsafeScriptPathError("잘못된 파일명입니다.");
  return path.join(SCRIPTS_ROOT, file);
}

export async function listScriptFiles(): Promise<string[]> {
  const entries = await fs.readdir(SCRIPTS_ROOT, { withFileTypes: true });
  return entries.filter((e) => e.isFile()).map((e) => e.name).sort();
}

export async function readScriptFile(file: string): Promise<string> {
  return fs.readFile(resolveScriptPath(file), "utf-8");
}

export async function writeScriptFile(file: string, content: string): Promise<void> {
  await fs.writeFile(resolveScriptPath(file), content, "utf-8");
}

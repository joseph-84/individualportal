import "server-only";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { prisma } from "./prisma";
import { SCRIPTS_ROOT } from "./scripts-fs";

const RUN_TIMEOUT_MS = 30_000;

function runnerFor(file: string): { cmd: string; args: string[] } | null {
  if (file.endsWith(".py")) return { cmd: "python3", args: [] };
  if (file.endsWith(".sh")) return { cmd: "bash", args: [] };
  return null;
}

export class ScriptRunError extends Error {}

/** Executes a whitelisted script and records a ScriptRun row. Shared by the manual
 * "실행" button and the cron scheduler so both go through identical validation. */
export async function executeScript(scriptId: string, triggeredBy: "manual" | "cron", userId?: string) {
  const script = await prisma.scriptDef.findUniqueOrThrow({ where: { id: scriptId } });
  if (!script.enabled) throw new ScriptRunError("비활성화된 스크립트입니다.");

  if (script.file.includes("/") || script.file.includes("..")) {
    throw new ScriptRunError("잘못된 스크립트 경로입니다.");
  }
  const fullPath = path.join(SCRIPTS_ROOT, script.file);
  if (!fullPath.startsWith(SCRIPTS_ROOT + path.sep) && fullPath !== SCRIPTS_ROOT) {
    throw new ScriptRunError("잘못된 스크립트 경로입니다.");
  }
  if (!fs.existsSync(fullPath)) {
    throw new ScriptRunError(`스크립트 파일을 찾을 수 없습니다: ${script.file}`);
  }

  const runner = runnerFor(script.file);
  if (!runner) throw new ScriptRunError("지원하지 않는 스크립트 형식입니다.");

  const run = await prisma.scriptRun.create({
    data: { scriptId: script.id, status: "running", triggeredBy, userId: userId ?? null },
  });

  const result = await new Promise<{ code: number | null; log: string }>((resolve) => {
    const child = spawn(runner.cmd, [fullPath], { cwd: SCRIPTS_ROOT, timeout: RUN_TIMEOUT_MS });
    let log = "";
    child.stdout.on("data", (d) => (log += d.toString()));
    child.stderr.on("data", (d) => (log += d.toString()));
    child.on("close", (code) => resolve({ code, log }));
    child.on("error", (err) => resolve({ code: -1, log: `${log}\n${err.message}` }));
  });

  await prisma.scriptRun.update({
    where: { id: run.id },
    data: {
      status: result.code === 0 ? "ok" : "err",
      exitCode: result.code,
      finishedAt: new Date(),
      log: result.log.slice(0, 20_000),
    },
  });

  return result;
}

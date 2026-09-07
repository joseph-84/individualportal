"use server";

import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePerm } from "@/lib/guard";
import { writeScriptFile } from "@/lib/scripts-fs";

const SCRIPTS_PATH = path.resolve(process.env.SCRIPTS_PATH || "./data-scripts");
const RUN_TIMEOUT_MS = 30_000;

function runnerFor(file: string): { cmd: string; args: string[] } | null {
  if (file.endsWith(".py")) return { cmd: "python3", args: [] };
  if (file.endsWith(".sh")) return { cmd: "bash", args: [] };
  return null;
}

export async function runScriptAction(scriptId: string) {
  const user = await requirePerm("automation", 2);

  const script = await prisma.scriptDef.findUniqueOrThrow({ where: { id: scriptId } });
  if (!script.enabled) throw new Error("비활성화된 스크립트입니다.");

  // whitelist guard: only a bare filename inside SCRIPTS_PATH may run
  if (script.file.includes("/") || script.file.includes("..")) {
    throw new Error("잘못된 스크립트 경로입니다.");
  }
  const fullPath = path.join(SCRIPTS_PATH, script.file);
  if (!fullPath.startsWith(SCRIPTS_PATH + path.sep) && fullPath !== SCRIPTS_PATH) {
    throw new Error("잘못된 스크립트 경로입니다.");
  }
  if (!fs.existsSync(fullPath)) {
    throw new Error(`스크립트 파일을 찾을 수 없습니다: ${script.file}`);
  }

  const runner = runnerFor(script.file);
  if (!runner) throw new Error("지원하지 않는 스크립트 형식입니다.");

  const run = await prisma.scriptRun.create({
    data: {
      scriptId: script.id,
      status: "running",
      triggeredBy: "manual",
      userId: user.id,
    },
  });

  const result = await new Promise<{ code: number | null; log: string }>((resolve) => {
    const child = spawn(runner.cmd, [fullPath], { cwd: SCRIPTS_PATH, timeout: RUN_TIMEOUT_MS });
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

  revalidatePath("/automation");
}

export async function saveScriptAction(file: string, content: string) {
  await requirePerm("editor", 2);
  if (file.includes("/") || file.includes("..")) throw new Error("잘못된 파일명입니다.");
  await writeScriptFile(file, content);
  revalidatePath("/editor");
}

export async function clearRunsAction() {
  await requirePerm("automation", 2);
  await prisma.scriptRun.deleteMany({});
  revalidatePath("/automation");
}

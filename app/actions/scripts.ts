"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePerm } from "@/lib/guard";
import { writeScriptFile, deleteScriptFile, createScriptFile } from "@/lib/scripts-fs";
import { executeScript } from "@/lib/run-script";
import { isValidCron } from "@/lib/cron";
import { writeAudit } from "@/lib/audit";

export async function runScriptAction(scriptId: string) {
  const user = await requirePerm("automation", 2);
  await executeScript(scriptId, "manual", user.id);
  revalidatePath("/automation");
}

export async function saveScriptAction(file: string, content: string) {
  const user = await requirePerm("editor", 2);
  if (file.includes("/") || file.includes("..")) throw new Error("잘못된 파일명입니다.");
  await writeScriptFile(file, content);
  await writeAudit(user, "script.save", file);
  revalidatePath("/editor");
}

export async function clearRunsAction() {
  await requirePerm("automation", 2);
  await prisma.scriptRun.deleteMany({});
  revalidatePath("/automation");
}

export interface ScriptFormState {
  error?: string;
}

export async function registerScriptAction(_prev: ScriptFormState, formData: FormData): Promise<ScriptFormState> {
  const user = await requirePerm("automation", 2);
  const file = String(formData.get("file") || "").trim();
  const lang = String(formData.get("lang") || "PY");
  const description = String(formData.get("description") || "").trim();
  const cron = String(formData.get("cron") || "").trim();

  if (!/^[a-zA-Z0-9._-]+\.(py|sh)$/.test(file)) {
    return { error: "파일명은 영문/숫자/._- 조합에 .py 또는 .sh 확장자여야 합니다." };
  }
  if (!description) return { error: "설명을 입력하세요." };
  if (cron && !isValidCron(cron)) {
    return { error: "cron 표현식이 올바르지 않습니다. 예: 0 9 * * * (분 시 일 월 요일)" };
  }

  const existing = await prisma.scriptDef.findUnique({ where: { file } });
  if (existing) return { error: "이미 등록된 파일명입니다." };

  const isNewFile = String(formData.get("createFile") || "") === "1";
  if (isNewFile) {
    const created = await createScriptFile(file, lang === "SH" ? "#!/usr/bin/env bash\nset -euo pipefail\n\n" : "#!/usr/bin/env python3\n\n");
    if (!created) return { error: "해당 이름의 파일이 이미 서버에 존재합니다. 다른 이름을 쓰거나 '새 파일 생성' 체크를 해제하세요." };
  }

  await prisma.scriptDef.create({ data: { file, lang, description, cron: cron || null } });
  await writeAudit(user, "script.register", file, { cron: cron || null });
  revalidatePath("/automation");
  revalidatePath("/editor");
  return {};
}

export async function updateScriptScheduleAction(_prev: ScriptFormState, formData: FormData): Promise<ScriptFormState> {
  const user = await requirePerm("automation", 2);
  const id = String(formData.get("id") || "");
  const cron = String(formData.get("cron") || "").trim();
  const description = String(formData.get("description") || "").trim();
  if (cron && !isValidCron(cron)) {
    return { error: "cron 표현식이 올바르지 않습니다." };
  }
  await prisma.scriptDef.update({ where: { id }, data: { cron: cron || null, description: description || undefined } });
  await writeAudit(user, "script.update", id, { cron: cron || null });
  revalidatePath("/automation");
  return {};
}

export async function toggleScriptEnabledAction(id: string) {
  const user = await requirePerm("automation", 2);
  const script = await prisma.scriptDef.findUniqueOrThrow({ where: { id } });
  await prisma.scriptDef.update({ where: { id }, data: { enabled: !script.enabled } });
  await writeAudit(user, script.enabled ? "script.disable" : "script.enable", script.file);
  revalidatePath("/automation");
}

export async function deleteScriptAction(id: string) {
  const user = await requirePerm("automation", 2);
  const script = await prisma.scriptDef.findUniqueOrThrow({ where: { id } });
  await prisma.scriptDef.delete({ where: { id } });
  await deleteScriptFile(script.file).catch(() => {});
  await writeAudit(user, "script.delete", script.file);
  revalidatePath("/automation");
  revalidatePath("/editor");
}

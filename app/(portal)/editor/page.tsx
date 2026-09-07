import { pageAccess } from "@/lib/guard";
import { Denied } from "@/components/Denied";
import { listScriptFiles, readScriptFile } from "@/lib/scripts-fs";
import { CodeEditor } from "@/components/CodeEditor";

export default async function EditorPage({ searchParams }: { searchParams: Promise<{ file?: string }> }) {
  const { user, level } = await pageAccess("editor");
  if (level === 0) return <Denied roleName={user.role.name} />;

  const files = await listScriptFiles();
  const { file } = await searchParams;
  const selected = file && files.includes(file) ? file : files[0];
  const content = selected ? await readScriptFile(selected) : "";

  return <CodeEditor files={files} selected={selected} content={content} canWrite={level === 2} />;
}

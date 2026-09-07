import { pageAccess } from "@/lib/guard";
import { Denied } from "@/components/Denied";
import { listDir, diskUsage } from "@/lib/files";
import { FilesBrowser } from "@/components/FilesBrowser";

export default async function FilesPage() {
  const { user, level } = await pageAccess("files");
  if (level === 0) return <Denied roleName={user.role.name} />;

  const [rootEntries, usage] = await Promise.all([listDir(""), diskUsage()]);

  return <FilesBrowser initialDir="" initialEntries={rootEntries} usedBytes={usage.used} canWrite={level === 2} />;
}

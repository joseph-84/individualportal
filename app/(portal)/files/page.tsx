import { pageAccess } from "@/lib/guard";
import { listDir, diskUsage } from "@/lib/files";
import { FilesBrowser } from "@/components/FilesBrowser";

export default async function FilesPage() {
  const { user, level } = await pageAccess("files");

  const [rootEntries, usage] = await Promise.all([listDir(""), diskUsage()]);

  return <FilesBrowser initialDir="" initialEntries={rootEntries} usedBytes={usage.used} canWrite={level === 2} />;
}

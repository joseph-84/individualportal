import { pageAccess } from "@/lib/guard";
import { TextDiffClient } from "@/components/TextDiffClient";

export default async function TextDiffPage() {
  await pageAccess("textdiff");
  return <TextDiffClient />;
}

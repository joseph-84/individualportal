import { NextResponse } from "next/server";
import path from "node:path";
import AdmZip from "adm-zip";
import { apiRequirePerm } from "@/lib/guard";

export const dynamic = "force-dynamic";

/** Zips chrome-extension/ fresh on every request rather than a prebuilt artifact in public/ --
 * nothing to regenerate/keep in sync, same source in dev and production. The folder itself
 * isn't part of Next's own module graph (no JS import reaches it), so it has to be copied into
 * the production image explicitly (see Dockerfile's runner stage) -- unlike the adm-zip
 * package itself, which Next's standalone output traces and bundles automatically. */
export async function GET() {
  const auth = await apiRequirePerm("settings", 1);
  if ("error" in auth) return auth.error;

  const zip = new AdmZip();
  zip.addLocalFolder(path.join(process.cwd(), "chrome-extension"));
  const buffer = zip.toBuffer();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="portal-favorites-extension.zip"',
      "Content-Length": String(buffer.length),
    },
  });
}

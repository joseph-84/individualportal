import { NextResponse, type NextRequest } from "next/server";
import path from "node:path";
import { apiRequirePerm } from "@/lib/guard";
import { writeFile, UnsafePathError } from "@/lib/files";

export async function POST(req: NextRequest) {
  const auth = await apiRequirePerm("files", 2);
  if ("error" in auth) return auth.error;

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const dir = String(form.get("dir") || "");
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "업로드할 파일이 없습니다." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const relPath = path.posix.join(dir, file.name);

  try {
    await writeFile(relPath, bytes);
    return NextResponse.json({ ok: true, path: relPath });
  } catch (e) {
    if (e instanceof UnsafePathError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "업로드에 실패했습니다." }, { status: 500 });
  }
}

import path from "node:path";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/guard";
import { readFileBuffer, UnsafePathError } from "@/lib/files";
import { isKbPath, resolveKbNote } from "@/lib/kb-files";
import { renderNote } from "@/lib/markdown";

/** Read-only rendered viewer for a .md/.html file (or KB note) from the file browser —
 * used by "새 창에서 보기" so the file opens as a formatted document instead of raw source. */
export default async function FileViewPage({ searchParams }: { searchParams: Promise<{ path?: string }> }) {
  await requireUser();
  const { path: relPath } = await searchParams;
  if (!relPath) notFound();

  let title: string;
  let html: string;

  if (isKbPath(relPath)) {
    const note = await resolveKbNote(relPath);
    if (!note) notFound();
    title = note.title;
    html = renderNote(note.content, note.format);
  } else {
    const ext = path.extname(relPath).replace(".", "").toUpperCase();
    if (ext !== "MD" && ext !== "HTML") notFound();
    try {
      const buf = await readFileBuffer(relPath);
      title = path.basename(relPath, path.extname(relPath));
      html = renderNote(buf.toString("utf-8"), ext === "HTML" ? "html" : "md");
    } catch (e) {
      if (e instanceof UnsafePathError) notFound();
      throw e;
    }
  }

  return (
    <section style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 15px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11.5, color: "var(--ink3)" }}>/{relPath.replace(/^__kb__\//, "지식베이스/")}</div>
      </div>
      <article style={{ padding: "26px 30px", maxWidth: 780 }}>
        <h1 style={{ margin: "0 0 16px", fontSize: 23, fontWeight: 600, letterSpacing: "-.02em" }}>{title}</h1>
        <div className="wiki-content" style={{ color: "var(--ink2)", fontSize: 14, lineHeight: 1.75 }} dangerouslySetInnerHTML={{ __html: html }} />
      </article>
    </section>
  );
}

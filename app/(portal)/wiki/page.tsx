import Link from "next/link";
import { pageAccess } from "@/lib/guard";
import { Denied } from "@/components/Denied";
import { prisma } from "@/lib/prisma";
import { renderMarkdown } from "@/lib/markdown";
import { WikiEditor } from "@/components/WikiEditor";

export default async function WikiPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { user, level } = await pageAccess("wiki");
  if (level === 0) return <Denied roleName={user.role.name} />;

  const { id } = await searchParams;
  const notes = await prisma.note.findMany({ orderBy: [{ folder: "asc" }, { title: "asc" }] });
  const selected = notes.find((n) => n.id === id) || notes[0] || null;

  const tags = Array.from(new Set(notes.flatMap((n) => n.tags))).sort();
  const grouped = new Map<string, typeof notes>();
  for (const n of notes) {
    const key = n.folder || "(미분류)";
    grouped.set(key, [...(grouped.get(key) || []), n]);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "226px minmax(340px,1fr)", gap: 12, alignItems: "start", overflowX: "auto" }}>
      <aside style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 10, position: "sticky", top: 70 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            height: 29,
            padding: "0 9px",
            marginBottom: 10,
            border: "1px solid var(--line)",
            borderRadius: 7,
            background: "var(--panel2)",
            color: "var(--ink3)",
            fontSize: 12,
          }}
        >
          <span>⌕</span>
          <span>{notes.length}개 문서</span>
        </div>
        {Array.from(grouped.entries()).map(([folder, list]) => (
          <div key={folder} style={{ marginBottom: 6 }}>
            <div style={{ padding: "5px 8px", fontSize: 11.5, fontWeight: 600, color: "var(--ink)" }}>{folder}</div>
            {list.map((n) => {
              const on = selected?.id === n.id;
              return (
                <Link
                  key={n.id}
                  href={`/wiki?id=${n.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    width: "100%",
                    padding: "5px 8px",
                    paddingLeft: 20,
                    borderRadius: 6,
                    background: on ? "var(--accent-soft)" : "transparent",
                    color: on ? "var(--accent)" : "var(--ink2)",
                    fontSize: 12.5,
                    fontWeight: on ? 600 : 400,
                    textDecoration: "none",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {n.title}
                </Link>
              );
            })}
          </div>
        ))}
        {notes.length === 0 && <div style={{ padding: "10px 8px", fontSize: 12, color: "var(--ink3)" }}>등록된 문서가 없습니다.</div>}
        {tags.length > 0 && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--line2)" }}>
            <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, fontWeight: 600, letterSpacing: ".1em", color: "var(--ink3)", marginBottom: 8 }}>
              TAGS
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {tags.map((t) => (
                <span key={t} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, border: "1px solid var(--line)", color: "var(--ink2)", background: "var(--panel2)" }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </aside>

      <section style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
        {selected ? (
          <WikiEditor
            noteId={selected.id}
            path={`${selected.folder ? selected.folder + " / " : ""}${selected.title}.md`}
            title={selected.title}
            content={selected.content}
            html={renderMarkdown(selected.content)}
            updatedAt={selected.updatedAt.toISOString()}
            canWrite={level === 2}
          />
        ) : (
          <div style={{ padding: 40, textAlign: "center", color: "var(--ink3)", fontSize: 13 }}>문서가 없습니다.</div>
        )}
      </section>
    </div>
  );
}

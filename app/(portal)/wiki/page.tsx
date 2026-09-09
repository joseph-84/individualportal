import { pageAccess } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { renderNote } from "@/lib/markdown";
import { WikiEditor } from "@/components/WikiEditor";
import { WikiSidebar } from "@/components/WikiSidebar";

export default async function WikiPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { user, level } = await pageAccess("wiki");

  const { id } = await searchParams;
  const notes = await prisma.note.findMany({ orderBy: [{ folder: "asc" }, { title: "asc" }] });
  const selected = notes.find((n) => n.id === id) || notes[0] || null;
  const tags = Array.from(new Set(notes.flatMap((n) => n.tags))).sort();

  return (
    <div className="wiki-grid" style={{ display: "grid", gridTemplateColumns: "226px minmax(340px,1fr)", gap: 12, alignItems: "start", overflowX: "auto" }}>
      <WikiSidebar
        notes={notes.map((n) => ({ id: n.id, title: n.title, folder: n.folder, tags: n.tags }))}
        tags={tags}
        selectedId={selected?.id}
        canWrite={level === 2}
      />

      <section style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
        {selected ? (
          <WikiEditor
            noteId={selected.id}
            path={`${selected.folder ? selected.folder + " / " : ""}${selected.title}.${selected.format}`}
            title={selected.title}
            format={selected.format}
            content={selected.content}
            html={renderNote(selected.content, selected.format)}
            updatedAt={selected.updatedAt.toISOString()}
            canWrite={level === 2}
          />
        ) : (
          <div style={{ padding: 40, textAlign: "center", color: "var(--ink3)", fontSize: 13 }}>
            {level === 2 ? "왼쪽 + 버튼으로 첫 문서를 만들어보세요." : "문서가 없습니다."}
          </div>
        )}
      </section>
    </div>
  );
}

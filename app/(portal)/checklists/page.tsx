import { pageAccess } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { renderSanitizedHtml } from "@/lib/markdown";
import { ChecklistDoc } from "@/components/ChecklistDoc";
import { ChecklistSidebar } from "@/components/ChecklistSidebar";

export default async function ChecklistsPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { user, level } = await pageAccess("checklists");

  const { id } = await searchParams;
  const checklists = await prisma.checklist.findMany({ orderBy: [{ folder: "asc" }, { title: "asc" }] });
  const selected = checklists.find((c) => c.id === id) || checklists[0] || null;

  return (
    <div className="wiki-grid" style={{ display: "grid", gridTemplateColumns: "226px minmax(340px,1fr)", gap: 12, alignItems: "start", overflowX: "auto" }}>
      <ChecklistSidebar
        checklists={checklists.map((c) => ({ id: c.id, title: c.title, folder: c.folder }))}
        selectedId={selected?.id}
        canWrite={level === 2}
      />

      <section style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
        {selected ? (
          <ChecklistDoc
            checklistId={selected.id}
            path={`${selected.folder ? selected.folder + " / " : ""}${selected.title}`}
            title={selected.title}
            content={selected.content}
            html={selected.content ? renderSanitizedHtml(selected.content) : ""}
            updatedAt={selected.updatedAt.toISOString()}
            canWrite={level === 2}
          />
        ) : (
          <div style={{ padding: 40, textAlign: "center", color: "var(--ink3)", fontSize: 13 }}>
            {level === 2 ? "왼쪽 + 버튼으로 첫 체크리스트를 만들어보세요." : "체크리스트가 없습니다."}
          </div>
        )}
      </section>
    </div>
  );
}

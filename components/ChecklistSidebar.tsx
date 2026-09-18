"use client";

import { useMemo, useState, useActionState } from "react";
import Link from "next/link";
import { createChecklistAction, type CreateChecklistState } from "@/app/actions/checklists";

interface ChecklistItem {
  id: string;
  title: string;
  folder: string;
}

const initial: CreateChecklistState = {};

function CreateChecklistForm({ onDone }: { onDone: () => void }) {
  const [state, formAction, pending] = useActionState(createChecklistAction, initial);
  return (
    <form action={formAction} style={{ display: "grid", gap: 6, marginBottom: 10, padding: 8, border: "1px solid var(--line)", borderRadius: 7, background: "var(--panel2)" }}>
      <input name="title" placeholder="제목" required autoFocus style={{ height: 26, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink)", fontSize: 12 }} />
      <input name="folder" placeholder="폴더 (예: 배포 / 점검)" style={{ height: 26, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink)", fontSize: 12 }} />
      <div style={{ display: "flex", gap: 5 }}>
        <button type="submit" disabled={pending} style={{ flex: 1, height: 26, border: 0, borderRadius: 5, background: "var(--accent)", color: "var(--on-accent)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          {pending ? "생성 중..." : "생성"}
        </button>
        <button type="button" onClick={onDone} style={{ height: 26, padding: "0 9px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink2)", fontSize: 12, cursor: "pointer" }}>
          취소
        </button>
      </div>
      {state.error && <div style={{ fontSize: 11, color: "var(--err)" }}>{state.error}</div>}
    </form>
  );
}

export function ChecklistSidebar({ checklists, selectedId, canWrite }: { checklists: ChecklistItem[]; selectedId?: string; canWrite: boolean }) {
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() => {
    if (!query) return checklists;
    const q = query.toLowerCase();
    return checklists.filter((c) => c.title.toLowerCase().includes(q) || c.folder.toLowerCase().includes(q));
  }, [checklists, query]);

  const grouped = useMemo(() => {
    const m = new Map<string, ChecklistItem[]>();
    for (const c of filtered) {
      const key = c.folder || "(미분류)";
      m.set(key, [...(m.get(key) || []), c]);
    }
    return m;
  }, [filtered]);

  return (
    <aside className="wiki-sidebar" style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 10, position: "sticky", top: 70 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            height: 29,
            padding: "0 9px",
            flex: 1,
            minWidth: 0,
            border: "1px solid var(--line)",
            borderRadius: 7,
            background: "var(--panel2)",
            color: "var(--ink3)",
            fontSize: 12,
          }}
        >
          <span>⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`${checklists.length}개 체크리스트 검색`}
            style={{ border: 0, background: "transparent", outline: "none", color: "var(--ink)", fontSize: 12, width: "100%" }}
          />
        </div>
        {canWrite && (
          <button
            onClick={() => setShowCreate((v) => !v)}
            title="새 체크리스트"
            style={{ width: 29, height: 29, border: "1px solid var(--line)", borderRadius: 7, background: "var(--panel2)", color: "var(--ink2)", cursor: "pointer", fontSize: 15, flex: "none" }}
          >
            +
          </button>
        )}
      </div>

      {showCreate && canWrite && <CreateChecklistForm onDone={() => setShowCreate(false)} />}

      {Array.from(grouped.entries()).map(([folder, list]) => (
        <div key={folder} style={{ marginBottom: 6 }}>
          <div style={{ padding: "5px 8px", fontSize: 11.5, fontWeight: 600, color: "var(--ink)" }}>{folder}</div>
          {list.map((c) => {
            const on = selectedId === c.id;
            return (
              <Link
                key={c.id}
                href={`/checklists?id=${c.id}`}
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
                {c.title}
              </Link>
            );
          })}
        </div>
      ))}
      {filtered.length === 0 && <div style={{ padding: "10px 8px", fontSize: 12, color: "var(--ink3)" }}>검색 결과가 없습니다.</div>}
    </aside>
  );
}

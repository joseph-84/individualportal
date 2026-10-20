"use client";

import { useMemo, useState, useTransition, useActionState } from "react";
import Link from "next/link";
import { createChecklistAction, moveChecklistAction, type CreateChecklistState } from "@/app/actions/checklists";

interface ChecklistItem {
  id: string;
  title: string;
  folder: string;
}

interface FolderNode {
  name: string;
  path: string;
  children: FolderNode[];
  items: ChecklistItem[];
}

/** Collapses "/a//b/ " style messiness from free-typed folder paths into a clean "a/b". */
function normalizeFolder(raw: string): string {
  return raw
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
    .join("/");
}

/** Builds an Explorer-style nested folder tree from Checklist.folder, treated purely
 * client-side as a "/"-delimited path -- no schema change, no separate Folder entity. A
 * folder only "exists" while at least one checklist references its path (same virtual-folder
 * convention already used for Note/Favorite), so dropping the last item out of a folder just
 * makes it disappear from the tree rather than needing explicit deletion. */
function buildFolderTree(checklists: ChecklistItem[]): FolderNode {
  const root: FolderNode = { name: "", path: "", children: [], items: [] };
  const byPath = new Map<string, FolderNode>([["", root]]);

  function ensureNode(path: string): FolderNode {
    const existing = byPath.get(path);
    if (existing) return existing;
    const segments = path.split("/");
    const name = segments[segments.length - 1];
    const parentPath = segments.slice(0, -1).join("/");
    const parent = ensureNode(parentPath);
    const node: FolderNode = { name, path, children: [], items: [] };
    parent.children.push(node);
    byPath.set(path, node);
    return node;
  }

  for (const c of checklists) {
    const path = normalizeFolder(c.folder);
    const node = path ? ensureNode(path) : root;
    node.items.push(c);
  }

  function sortNode(n: FolderNode) {
    n.children.sort((a, b) => a.name.localeCompare(b.name));
    n.items.sort((a, b) => a.title.localeCompare(b.title));
    n.children.forEach(sortNode);
  }
  sortNode(root);
  return root;
}

function countAll(node: FolderNode): number {
  return node.items.length + node.children.reduce((sum, c) => sum + countAll(c), 0);
}

const initial: CreateChecklistState = {};

function CreateChecklistForm({ onDone }: { onDone: () => void }) {
  const [state, formAction, pending] = useActionState(createChecklistAction, initial);
  return (
    <form action={formAction} style={{ display: "grid", gap: 6, marginBottom: 10, padding: 8, border: "1px solid var(--line)", borderRadius: 7, background: "var(--panel2)" }}>
      <input name="title" placeholder="제목" required autoFocus style={{ height: 26, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink)", fontSize: 12 }} />
      <input name="folder" placeholder='폴더 (예: "업무/배포", 비우면 Root)' style={{ height: 26, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink)", fontSize: 12 }} />
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

function MoveForm({ item, onDone }: { item: ChecklistItem; onDone: () => void }) {
  const [, startTransition] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem("folder") as HTMLInputElement;
        startTransition(() => moveChecklistAction(item.id, normalizeFolder(input.value)));
        onDone();
      }}
      onClick={(e) => e.stopPropagation()}
      style={{ display: "flex", gap: 4, padding: "4px 8px", paddingLeft: 36 }}
    >
      <input
        name="folder"
        defaultValue={item.folder}
        autoFocus
        placeholder='예: "업무/배포" (비우면 Root)'
        style={{ flex: 1, height: 24, padding: "0 7px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink)", fontSize: 11.5 }}
      />
      <button type="submit" style={{ height: 24, padding: "0 8px", border: 0, borderRadius: 5, background: "var(--accent)", color: "var(--on-accent)", fontSize: 11, cursor: "pointer" }}>
        이동
      </button>
      <button type="button" onClick={onDone} style={{ height: 24, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink2)", fontSize: 11, cursor: "pointer" }}>
        취소
      </button>
    </form>
  );
}

function ChecklistRow({
  item,
  depth,
  selectedId,
  canWrite,
  dragEnabled,
  dragged,
  setDragged,
  movingId,
  setMovingId,
}: {
  item: ChecklistItem;
  depth: number;
  selectedId?: string;
  canWrite: boolean;
  dragEnabled: boolean;
  dragged: { id: string; folder: string } | null;
  setDragged: (d: { id: string; folder: string } | null) => void;
  movingId: string | null;
  setMovingId: (id: string | null) => void;
}) {
  const [dragArmed, setDragArmed] = useState(false);
  const on = selectedId === item.id;

  if (movingId === item.id) {
    return <MoveForm item={item} onDone={() => setMovingId(null)} />;
  }

  return (
    <div
      draggable={canWrite && dragEnabled && dragArmed}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        setDragged({ id: item.id, folder: normalizeFolder(item.folder) });
      }}
      onDragEnd={() => {
        setDragArmed(false);
        setDragged(null);
      }}
      style={{ display: "flex", alignItems: "center", gap: 4, paddingLeft: 8 + depth * 14, opacity: dragged?.id === item.id ? 0.4 : 1 }}
    >
      {canWrite && dragEnabled && (
        <span
          onMouseDown={() => setDragArmed(true)}
          onMouseUp={() => setDragArmed(false)}
          style={{ width: 10, flex: "none", color: "var(--ink3)", fontSize: 10, cursor: "grab", userSelect: "none" }}
          title="드래그해서 폴더 이동"
        >
          ⠿
        </span>
      )}
      <Link
        href={`/checklists?id=${item.id}`}
        style={{
          flex: 1,
          minWidth: 0,
          display: "block",
          padding: "5px 8px",
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
        {item.title}
      </Link>
      {canWrite && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMovingId(item.id);
          }}
          title="다른 폴더로 이동 (새 폴더 경로도 입력 가능)"
          style={{ width: 18, height: 18, border: 0, background: "transparent", color: "var(--ink3)", cursor: "pointer", fontSize: 10.5, flex: "none" }}
        >
          ⤷
        </button>
      )}
    </div>
  );
}

function FolderRow({
  node,
  depth,
  selectedId,
  collapsed,
  toggleCollapse,
  canWrite,
  dragEnabled,
  dragged,
  setDragged,
  onDropOnFolder,
  movingId,
  setMovingId,
}: {
  node: FolderNode;
  depth: number;
  selectedId?: string;
  collapsed: Set<string>;
  toggleCollapse: (path: string) => void;
  canWrite: boolean;
  dragEnabled: boolean;
  dragged: { id: string; folder: string } | null;
  setDragged: (d: { id: string; folder: string } | null) => void;
  onDropOnFolder: (path: string) => void;
  movingId: string | null;
  setMovingId: (id: string | null) => void;
}) {
  const isRoot = node.path === "";
  const isCollapsed = collapsed.has(node.path);
  const canAcceptDrop = canWrite && dragEnabled && !!dragged && dragged.folder !== node.path;
  const childDepth = isRoot ? depth : depth + 1;

  return (
    <div
      onDragOver={(e) => {
        if (!canAcceptDrop) return;
        e.preventDefault();
      }}
      onDrop={(e) => {
        if (!canAcceptDrop) return;
        e.preventDefault();
        e.stopPropagation();
        onDropOnFolder(node.path);
      }}
    >
      {!isRoot && (
        <div
          onClick={() => toggleCollapse(node.path)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", paddingLeft: 8 + depth * 14, cursor: "pointer" }}
        >
          <span style={{ fontSize: 9, color: "var(--ink3)", width: 10, flex: "none" }}>{isCollapsed ? "▸" : "▾"}</span>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink)" }}>{node.name}</span>
          <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10.5, color: "var(--ink3)" }}>{countAll(node)}</span>
        </div>
      )}
      {!isCollapsed &&
        node.children.map((child) => (
          <FolderRow
            key={child.path}
            node={child}
            depth={childDepth}
            selectedId={selectedId}
            collapsed={collapsed}
            toggleCollapse={toggleCollapse}
            canWrite={canWrite}
            dragEnabled={dragEnabled}
            dragged={dragged}
            setDragged={setDragged}
            onDropOnFolder={onDropOnFolder}
            movingId={movingId}
            setMovingId={setMovingId}
          />
        ))}
      {!isCollapsed &&
        node.items.map((item) => (
          <ChecklistRow
            key={item.id}
            item={item}
            depth={childDepth}
            selectedId={selectedId}
            canWrite={canWrite}
            dragEnabled={dragEnabled}
            dragged={dragged}
            setDragged={setDragged}
            movingId={movingId}
            setMovingId={setMovingId}
          />
        ))}
    </div>
  );
}

export function ChecklistSidebar({ checklists, selectedId, canWrite }: { checklists: ChecklistItem[]; selectedId?: string; canWrite: boolean }) {
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragged, setDragged] = useState<{ id: string; folder: string } | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const dragEnabled = !query;

  const filtered = useMemo(() => {
    if (!query) return checklists;
    const q = query.toLowerCase();
    return checklists.filter((c) => c.title.toLowerCase().includes(q) || c.folder.toLowerCase().includes(q));
  }, [checklists, query]);

  const tree = useMemo(() => buildFolderTree(filtered), [filtered]);

  const toggleCollapse = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleDropOnFolder = (path: string) => {
    if (!dragged) return;
    startTransition(() => moveChecklistAction(dragged.id, path));
    setDragged(null);
  };

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

      <FolderRow
        node={tree}
        depth={0}
        selectedId={selectedId}
        collapsed={collapsed}
        toggleCollapse={toggleCollapse}
        canWrite={canWrite}
        dragEnabled={dragEnabled}
        dragged={dragged}
        setDragged={setDragged}
        onDropOnFolder={handleDropOnFolder}
        movingId={movingId}
        setMovingId={setMovingId}
      />
      {filtered.length === 0 && <div style={{ padding: "10px 8px", fontSize: 12, color: "var(--ink3)" }}>검색 결과가 없습니다.</div>}
    </aside>
  );
}

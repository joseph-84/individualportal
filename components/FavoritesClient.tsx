"use client";

import { useMemo, useState, useTransition, useActionState } from "react";
import { createFavoriteAction, editFavoriteAction, deleteFavoriteAction, moveFavoriteAction, type FavoriteFormState } from "@/app/actions/favorites";

interface FavoriteItem {
  id: string;
  title: string;
  url: string;
  folder: string;
  order: number;
}

interface DragState {
  id: string;
  folder: string;
}
interface DropTarget {
  id: string;
  folder: string;
  pos: "before" | "after";
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

const initial: FavoriteFormState = {};

function FavoriteForm({ favorite, defaultFolder, onDone }: { favorite?: FavoriteItem; defaultFolder?: string; onDone: () => void }) {
  const action = favorite ? editFavoriteAction : createFavoriteAction;
  const [state, formAction, pending] = useActionState(async (_prev: FavoriteFormState, fd: FormData) => {
    const res = await action(_prev, fd);
    if (!res.error) onDone();
    return res;
  }, initial);

  return (
    <form action={formAction} style={{ display: "grid", gap: 6, padding: 8, border: "1px solid var(--line)", borderRadius: 7, background: "var(--panel2)" }}>
      {favorite && <input type="hidden" name="id" value={favorite.id} />}
      <input
        name="title"
        defaultValue={favorite?.title}
        placeholder="제목"
        required
        autoFocus
        style={{ height: 27, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink)", fontSize: 12.5 }}
      />
      <input
        name="url"
        defaultValue={favorite?.url}
        placeholder="URL (예: example.com 또는 문서 링크)"
        required
        style={{ height: 27, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink)", fontSize: 12.5 }}
      />
      <input
        name="folder"
        defaultValue={favorite?.folder ?? defaultFolder ?? ""}
        placeholder="폴더 (예: 업무 도구, 비워두면 미분류)"
        style={{ height: 27, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink)", fontSize: 12.5 }}
      />
      {state.error && <div style={{ fontSize: 11.5, color: "var(--err)" }}>{state.error}</div>}
      <div style={{ display: "flex", gap: 5 }}>
        <button type="submit" disabled={pending} style={{ flex: 1, height: 27, border: 0, borderRadius: 5, background: "var(--accent)", color: "var(--on-accent)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          {pending ? "저장 중..." : favorite ? "저장" : "추가"}
        </button>
        <button type="button" onClick={onDone} style={{ height: 27, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink2)", fontSize: 12, cursor: "pointer" }}>
          취소
        </button>
      </div>
    </form>
  );
}

function FavoriteRow({
  favorite,
  canWrite,
  dragEnabled,
  dragged,
  setDragged,
  dropTarget,
  setDropTarget,
  onDrop,
  onEdit,
}: {
  favorite: FavoriteItem;
  canWrite: boolean;
  dragEnabled: boolean;
  dragged: DragState | null;
  setDragged: (d: DragState | null) => void;
  dropTarget: DropTarget | null;
  setDropTarget: (d: DropTarget | null) => void;
  onDrop: (targetId: string, folder: string, pos: "before" | "after") => void;
  onEdit: () => void;
}) {
  const [, startTransition] = useTransition();
  const [dragArmed, setDragArmed] = useState(false);
  const open = () => window.open(favorite.url, "_blank", "noopener,noreferrer");
  const canAcceptDrop = canWrite && dragged && dragged.id !== favorite.id;
  const showTopLine = canAcceptDrop && dropTarget?.id === favorite.id && dropTarget.pos === "before";
  const showBottomLine = canAcceptDrop && dropTarget?.id === favorite.id && dropTarget.pos === "after";

  return (
    <div
      draggable={canWrite && dragEnabled && dragArmed}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        setDragged({ id: favorite.id, folder: favorite.folder });
      }}
      onDragEnd={() => {
        setDragArmed(false);
        setDragged(null);
        setDropTarget(null);
      }}
      onDragOver={(e) => {
        if (!canAcceptDrop) return;
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        const pos = e.clientY - rect.top < rect.height / 2 ? "before" : "after";
        if (dropTarget?.id !== favorite.id || dropTarget.pos !== pos) setDropTarget({ id: favorite.id, folder: favorite.folder, pos });
      }}
      onDrop={(e) => {
        if (!canAcceptDrop || !dropTarget) return;
        e.preventDefault();
        e.stopPropagation();
        onDrop(favorite.id, favorite.folder, dropTarget.pos);
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 8px",
        paddingLeft: 22,
        borderRadius: 6,
        borderTop: showTopLine ? "2px solid var(--accent)" : "2px solid transparent",
        borderBottom: showBottomLine ? "2px solid var(--accent)" : undefined,
        opacity: dragged?.id === favorite.id ? 0.4 : 1,
      }}
    >
      {canWrite && dragEnabled && (
        <span
          onMouseDown={() => setDragArmed(true)}
          onMouseUp={() => setDragArmed(false)}
          style={{ width: 10, flex: "none", color: "var(--ink3)", fontSize: 10, cursor: "grab", userSelect: "none" }}
          title="드래그해서 이동"
        >
          ⠿
        </span>
      )}
      <div
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open()}
        style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", gap: 7, cursor: "pointer", overflow: "hidden" }}
      >
        <span style={{ fontSize: 12.5, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{favorite.title}</span>
        <span style={{ fontSize: 10.5, color: "var(--ink3)", fontFamily: "var(--font-mono), monospace", flex: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {hostOf(favorite.url)}
        </span>
      </div>
      {canWrite && (
        <div style={{ display: "flex", gap: 3, flex: "none" }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onEdit}
            title="편집"
            style={{ width: 20, height: 20, border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink2)", cursor: "pointer", fontSize: 10.5 }}
          >
            ✎
          </button>
          <button
            onClick={() => confirm(`"${favorite.title}"을(를) 삭제할까요?`) && startTransition(() => deleteFavoriteAction(favorite.id))}
            title="삭제"
            style={{ width: 20, height: 20, border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink3)", cursor: "pointer", fontSize: 10.5 }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export function FavoritesClient({ favorites, canWrite }: { favorites: FavoriteItem[]; canWrite: boolean }) {
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragged, setDragged] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [, startTransition] = useTransition();

  const dragEnabled = !query;

  const byFolder = useMemo(() => {
    const m = new Map<string, FavoriteItem[]>();
    for (const f of favorites) m.set(f.folder, [...(m.get(f.folder) || []), f]);
    return m;
  }, [favorites]);

  const filtered = useMemo(() => {
    if (!query) return favorites;
    const q = query.toLowerCase();
    return favorites.filter((f) => f.title.toLowerCase().includes(q) || f.folder.toLowerCase().includes(q) || f.url.toLowerCase().includes(q));
  }, [favorites, query]);

  const grouped = useMemo(() => {
    const m = new Map<string, FavoriteItem[]>();
    for (const f of filtered) m.set(f.folder, [...(m.get(f.folder) || []), f]);
    return m;
  }, [filtered]);

  const toggleCollapse = (folder: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  };

  const moveFavorite = (targetId: string | null, folder: string, pos: "before" | "after") => {
    if (!dragged) return;
    const list = byFolder.get(folder) || [];
    let beforeOrder: number | null = null;
    let afterOrder: number | null = null;
    if (targetId === null) {
      const last = list[list.length - 1];
      beforeOrder = last && last.id !== dragged.id ? last.order : null;
    } else {
      const idx = list.findIndex((f) => f.id === targetId);
      if (idx === -1) return;
      if (pos === "before") {
        afterOrder = list[idx].order;
        const prev = list[idx - 1];
        beforeOrder = prev && prev.id !== dragged.id ? prev.order : null;
      } else {
        beforeOrder = list[idx].order;
        const next = list[idx + 1];
        afterOrder = next && next.id !== dragged.id ? next.order : null;
      }
    }
    startTransition(() => moveFavoriteAction(dragged.id, folder, beforeOrder, afterOrder));
    setDragged(null);
    setDropTarget(null);
  };

  return (
    <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
      <div style={{ display: "flex", gap: 6 }}>
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
            placeholder={`${favorites.length}개 검색`}
            style={{ border: 0, background: "transparent", outline: "none", color: "var(--ink)", fontSize: 12, width: "100%" }}
          />
        </div>
        {canWrite && (
          <button
            onClick={() => setShowCreate((v) => !v)}
            title="새 즐겨찾기"
            style={{ width: 29, height: 29, border: "1px solid var(--line)", borderRadius: 7, background: "var(--panel2)", color: "var(--ink2)", cursor: "pointer", fontSize: 15, flex: "none" }}
          >
            +
          </button>
        )}
      </div>

      {showCreate && canWrite && <FavoriteForm onDone={() => setShowCreate(false)} />}

      {filtered.length === 0 && (
        <div style={{ padding: "18px 4px", fontSize: 12.5, color: "var(--ink3)" }}>{favorites.length === 0 ? "등록된 즐겨찾기가 없습니다." : "검색 결과가 없습니다."}</div>
      )}

      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: filtered.length ? 4 : 0 }}>
        {Array.from(grouped.entries()).map(([folder, list]) => {
          const isCollapsed = collapsed.has(folder);
          const canAcceptDropOnHeader = canWrite && dragEnabled && dragged && dragged.folder !== folder;
          return (
            <div key={folder}>
              <div
                onClick={() => toggleCollapse(folder)}
                onDragOver={(e) => {
                  if (!canAcceptDropOnHeader) return;
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  if (!canAcceptDropOnHeader) return;
                  e.preventDefault();
                  moveFavorite(null, folder, "after");
                }}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", cursor: "pointer" }}
              >
                <span style={{ fontSize: 9, color: "var(--ink3)", width: 10, flex: "none" }}>{isCollapsed ? "▸" : "▾"}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink)" }}>{folder || "(미분류)"}</span>
                <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10.5, color: "var(--ink3)" }}>{list.length}</span>
              </div>
              {!isCollapsed &&
                list.map((f) =>
                  editingId === f.id ? (
                    <div key={f.id} style={{ padding: "2px 8px 6px 22px" }}>
                      <FavoriteForm favorite={f} onDone={() => setEditingId(null)} />
                    </div>
                  ) : (
                    <FavoriteRow
                      key={f.id}
                      favorite={f}
                      canWrite={canWrite}
                      dragEnabled={dragEnabled}
                      dragged={dragged}
                      setDragged={setDragged}
                      dropTarget={dropTarget}
                      setDropTarget={setDropTarget}
                      onDrop={moveFavorite}
                      onEdit={() => setEditingId(f.id)}
                    />
                  )
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

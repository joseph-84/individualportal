"use client";

import { useMemo, useState, useTransition, useActionState } from "react";
import { createFavoriteAction, editFavoriteAction, deleteFavoriteAction, type FavoriteFormState } from "@/app/actions/favorites";

interface FavoriteItem {
  id: string;
  title: string;
  url: string;
  folder: string;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

const initial: FavoriteFormState = {};

function FavoriteForm({
  favorite,
  onDone,
}: {
  favorite?: FavoriteItem;
  onDone: () => void;
}) {
  const action = favorite ? editFavoriteAction : createFavoriteAction;
  const [state, formAction, pending] = useActionState(async (_prev: FavoriteFormState, fd: FormData) => {
    const res = await action(_prev, fd);
    if (!res.error) onDone();
    return res;
  }, initial);

  return (
    <form action={formAction} style={{ display: "grid", gap: 8, padding: 12, background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: 8 }}>
      {favorite && <input type="hidden" name="id" value={favorite.id} />}
      <input
        name="title"
        defaultValue={favorite?.title}
        placeholder="제목"
        required
        autoFocus
        style={{ height: 30, padding: "0 9px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel)", color: "var(--ink)", fontSize: 12.5 }}
      />
      <input
        name="url"
        defaultValue={favorite?.url}
        placeholder="URL (예: https://example.com 또는 문서 링크)"
        required
        style={{ height: 30, padding: "0 9px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel)", color: "var(--ink)", fontSize: 12.5 }}
      />
      <input
        name="folder"
        defaultValue={favorite?.folder}
        placeholder="폴더 (예: 업무 도구)"
        style={{ height: 30, padding: "0 9px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel)", color: "var(--ink)", fontSize: 12.5 }}
      />
      {state.error && <div style={{ fontSize: 12, color: "var(--err)" }}>{state.error}</div>}
      <div style={{ display: "flex", gap: 6 }}>
        <button type="submit" disabled={pending} style={{ height: 30, padding: "0 14px", border: 0, borderRadius: 6, background: "var(--accent)", color: "var(--on-accent)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
          {pending ? "저장 중..." : favorite ? "저장" : "추가"}
        </button>
        <button type="button" onClick={onDone} style={{ height: 30, padding: "0 14px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel)", color: "var(--ink2)", fontSize: 12.5, cursor: "pointer" }}>
          취소
        </button>
      </div>
    </form>
  );
}

function FavoriteCard({ favorite, canWrite, onEdit }: { favorite: FavoriteItem; canWrite: boolean; onEdit: () => void }) {
  const [, startTransition] = useTransition();

  const open = () => window.open(favorite.url, "_blank", "noopener,noreferrer");

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open()}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        border: "1px solid var(--line)",
        borderRadius: 8,
        background: "var(--panel)",
        cursor: "pointer",
      }}
    >
      <div style={{ width: 26, height: 26, borderRadius: 6, background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center", fontSize: 12, flex: "none" }}>
        ⤢
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{favorite.title}</div>
        <div style={{ fontSize: 11, color: "var(--ink3)", fontFamily: "var(--font-mono), monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {hostOf(favorite.url)}
        </div>
      </div>
      {canWrite && (
        <div style={{ display: "flex", gap: 4, flex: "none" }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onEdit}
            title="편집"
            style={{ width: 22, height: 22, border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel2)", color: "var(--ink2)", cursor: "pointer", fontSize: 11 }}
          >
            ✎
          </button>
          <button
            onClick={() => confirm(`"${favorite.title}"을(를) 삭제할까요?`) && startTransition(() => deleteFavoriteAction(favorite.id))}
            title="삭제"
            style={{ width: 22, height: 22, border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel2)", color: "var(--ink3)", cursor: "pointer", fontSize: 11 }}
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

  const filtered = useMemo(() => {
    if (!query) return favorites;
    const q = query.toLowerCase();
    return favorites.filter((f) => f.title.toLowerCase().includes(q) || f.folder.toLowerCase().includes(q) || f.url.toLowerCase().includes(q));
  }, [favorites, query]);

  const grouped = useMemo(() => {
    const m = new Map<string, FavoriteItem[]>();
    for (const f of filtered) {
      const key = f.folder || "(미분류)";
      m.set(key, [...(m.get(key) || []), f]);
    }
    return m;
  }, [filtered]);

  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 780 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            height: 32,
            padding: "0 10px",
            flex: 1,
            minWidth: 0,
            border: "1px solid var(--line)",
            borderRadius: 7,
            background: "var(--panel2)",
            color: "var(--ink3)",
            fontSize: 12.5,
          }}
        >
          <span>⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`${favorites.length}개 즐겨찾기 검색`}
            style={{ border: 0, background: "transparent", outline: "none", color: "var(--ink)", fontSize: 12.5, width: "100%" }}
          />
        </div>
        {canWrite && (
          <button
            onClick={() => setShowCreate((v) => !v)}
            style={{ height: 32, padding: "0 14px", border: 0, borderRadius: 7, background: "var(--accent)", color: "var(--on-accent)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            + 즐겨찾기 추가
          </button>
        )}
      </div>

      {showCreate && canWrite && <FavoriteForm onDone={() => setShowCreate(false)} />}

      {filtered.length === 0 && <div style={{ padding: "24px 4px", fontSize: 12.5, color: "var(--ink3)" }}>{favorites.length === 0 ? "등록된 즐겨찾기가 없습니다." : "검색 결과가 없습니다."}</div>}

      {Array.from(grouped.entries()).map(([folder, list]) => (
        <div key={folder}>
          <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, fontWeight: 600, letterSpacing: ".1em", color: "var(--ink3)", marginBottom: 8, padding: "0 2px" }}>
            {folder.toUpperCase()}
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {list.map((f) =>
              editingId === f.id ? (
                <FavoriteForm key={f.id} favorite={f} onDone={() => setEditingId(null)} />
              ) : (
                <FavoriteCard key={f.id} favorite={f} canWrite={canWrite} onEdit={() => setEditingId(f.id)} />
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

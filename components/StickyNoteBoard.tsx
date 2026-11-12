"use client";

import { useEffect, useRef, useState, useTransition, type PointerEvent } from "react";
import {
  createStickyNoteAction,
  updateStickyNoteContentAction,
  updateStickyNoteTitleAction,
  setStickyNoteColorAction,
  moveStickyNoteAction,
  resizeStickyNoteAction,
  setStickyNoteCollapsedAction,
  deleteStickyNoteAction,
} from "@/app/actions/sticky-notes";

interface NoteItem {
  id: string;
  title: string;
  content: string;
  color: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  collapsed: boolean;
}

const MIN_WIDTH = 120;
const MIN_HEIGHT = 90;
const MAX_WIDTH = 420;
const MAX_HEIGHT = 420;

// Fixed, real-sticky-note-ish colors -- deliberately not theme tokens, since a postit's color
// is part of its identity and shouldn't flip with light/dark mode. Keep names in sync with
// lib/sticky-notes.ts's STICKY_COLORS (that file is server-only, so can't be imported here).
const PALETTE: Record<string, { bg: string; ink: string }> = {
  yellow: { bg: "#f7e07a", ink: "#4a3f12" },
  pink: { bg: "#f3aec0", ink: "#5a1f2c" },
  blue: { bg: "#a6d4ef", ink: "#1b3a4b" },
  green: { bg: "#b8e0a8", ink: "#1f3d16" },
  purple: { bg: "#d2bdee", ink: "#3a2650" },
};
const COLOR_ORDER = ["yellow", "pink", "blue", "green", "purple"];

/** Deterministic -2..2deg tilt from the note's id, so the same note always renders with the
 * same slight rotation (real postit feel) without needing a stored field. */
function rotationFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 400) / 100) - 2;
}

function NoteCard({
  note,
  canWrite,
  front,
  onDragStart,
  onMove,
  onSaveContent,
  onSaveTitle,
  onSetColor,
  onResize,
  onToggleCollapse,
  onDelete,
}: {
  note: NoteItem;
  canWrite: boolean;
  front: boolean;
  onDragStart: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onSaveContent: (id: string, content: string) => void;
  onSaveTitle: (id: string, title: string) => void;
  onSetColor: (id: string, color: string) => void;
  onResize: (id: string, width: number, height: number) => void;
  onToggleCollapse: (id: string, collapsed: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [pos, setPos] = useState({ x: note.x, y: note.y });
  const [dims, setDims] = useState({ width: note.width, height: note.height });
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.content);
  const [title, setTitle] = useState(note.title);
  const dragInfo = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const resizeInfo = useRef<{ sx: number; sy: number; ow: number; oh: number } | null>(null);
  const movedRef = useRef(false);

  useEffect(() => setPos({ x: note.x, y: note.y }), [note.x, note.y]);
  useEffect(() => setDims({ width: note.width, height: note.height }), [note.width, note.height]);
  useEffect(() => setText(note.content), [note.content]);
  useEffect(() => setTitle(note.title), [note.title]);

  const palette = PALETTE[note.color] ?? PALETTE.yellow;
  const rotate = rotationFor(note.id);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!canWrite) return;
    if ((e.target as HTMLElement).closest("textarea, button, input")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    movedRef.current = false;
    dragInfo.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
    setDragging(true);
    onDragStart(note.id);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragInfo.current) return;
    const dx = e.clientX - dragInfo.current.sx;
    const dy = e.clientY - dragInfo.current.sy;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) movedRef.current = true;
    setPos({ x: dragInfo.current.ox + dx, y: dragInfo.current.oy + dy });
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragInfo.current) return;
    const didMove = movedRef.current;
    dragInfo.current = null;
    movedRef.current = false;
    setDragging(false);
    if (didMove) {
      // Dragged: persist the new position. A plain click (no movement) never reaches here as
      // a drag, so it falls through to opening the editor below -- pointer capture (needed so
      // drag keeps tracking once the cursor leaves the card) retargets the native "click" event
      // to this element too, which is why editing can't be triggered by a separate onClick on
      // the inner content div.
      onMove(note.id, pos.x, pos.y);
    } else if (canWrite && !editing) {
      setEditing(true);
    }
  };

  const onResizePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!canWrite) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeInfo.current = { sx: e.clientX, sy: e.clientY, ow: dims.width, oh: dims.height };
    setResizing(true);
  };
  const onResizePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!resizeInfo.current) return;
    e.stopPropagation();
    const { sx, sy, ow, oh } = resizeInfo.current;
    const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, ow + (e.clientX - sx)));
    const height = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, oh + (e.clientY - sy)));
    setDims({ width, height });
  };
  const onResizePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!resizeInfo.current) return;
    e.stopPropagation();
    resizeInfo.current = null;
    setResizing(false);
    onResize(note.id, dims.width, dims.height);
  };

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        width: dims.width,
        minHeight: note.collapsed ? undefined : dims.height,
        padding: "7px 9px 10px",
        borderRadius: 3,
        background: palette.bg,
        color: palette.ink,
        boxShadow: dragging || resizing ? "0 10px 20px rgba(0,0,0,.28)" : "0 3px 8px rgba(0,0,0,.18)",
        transform: `rotate(${rotate}deg)${dragging ? " scale(1.03)" : ""}`,
        transition: dragging || resizing ? "none" : "box-shadow .15s, transform .15s",
        cursor: canWrite ? (dragging ? "grabbing" : "grab") : "default",
        zIndex: front ? 1000 : note.z,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        touchAction: "none",
        userSelect: "none",
      }}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          if (title !== note.title) onSaveTitle(note.id, title);
        }}
        placeholder="제목 없음"
        disabled={!canWrite}
        style={{
          border: 0,
          background: "transparent",
          color: palette.ink,
          fontSize: 13,
          fontWeight: 700,
          outline: "none",
          padding: 0,
          width: "100%",
          flex: "none",
          cursor: canWrite ? "text" : "default",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 4, flex: "none" }}>
        {canWrite &&
          COLOR_ORDER.map((c) => (
            <button
              key={c}
              onClick={() => onSetColor(note.id, c)}
              title={c}
              style={{
                width: 11,
                height: 11,
                borderRadius: "50%",
                border: c === note.color ? "1.5px solid rgba(0,0,0,.45)" : "1px solid rgba(0,0,0,.15)",
                background: PALETTE[c].bg,
                cursor: "pointer",
                padding: 0,
                flex: "none",
              }}
            />
          ))}
        {canWrite && (
          <button
            onClick={() => onToggleCollapse(note.id, !note.collapsed)}
            title={note.collapsed ? "펼치기" : "접기"}
            style={{ marginLeft: "auto", border: 0, background: "transparent", color: palette.ink, opacity: 0.55, cursor: "pointer", fontSize: 11, padding: 0, lineHeight: 1 }}
          >
            {note.collapsed ? "▸" : "▾"}
          </button>
        )}
        {canWrite && (
          <button
            onClick={() => onDelete(note.id)}
            title="삭제"
            style={{ border: 0, background: "transparent", color: palette.ink, opacity: 0.55, cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1 }}
          >
            ✕
          </button>
        )}
      </div>
      {!note.collapsed && (
        <>
        {editing ? (
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (text !== note.content) onSaveContent(note.id, text);
          }}
          style={{
            flex: 1,
            resize: "none",
            border: 0,
            background: "transparent",
            color: palette.ink,
            fontSize: 13,
            lineHeight: 1.4,
            fontFamily: "inherit",
            outline: "none",
            userSelect: "text",
          }}
        />
      ) : (
        <div
          style={{
            flex: 1,
            fontSize: 13,
            lineHeight: 1.4,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            cursor: canWrite ? "text" : "default",
            opacity: text ? 1 : 0.5,
          }}
        >
          {text || "클릭해서 메모 작성..."}
        </div>
        )}
        {canWrite && (
          <div
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
            title="크기 조절"
            style={{
              position: "absolute",
              right: 2,
              bottom: 2,
              width: 14,
              height: 14,
              lineHeight: 1,
              fontSize: 11,
              opacity: 0.45,
              cursor: "nwse-resize",
              touchAction: "none",
              userSelect: "none",
            }}
          >
            ⌟
          </div>
        )}
        </>
      )}
    </div>
  );
}

export function StickyNoteBoard({ canWrite, notes }: { canWrite: boolean; notes: NoteItem[] }) {
  const [, startTransition] = useTransition();
  const [frontId, setFrontId] = useState<string | null>(null);

  const add = () => startTransition(() => void createStickyNoteAction());
  const move = (id: string, x: number, y: number) => startTransition(() => void moveStickyNoteAction(id, x, y));
  const saveContent = (id: string, content: string) => startTransition(() => void updateStickyNoteContentAction(id, content));
  const saveTitle = (id: string, title: string) => startTransition(() => void updateStickyNoteTitleAction(id, title));
  const setColor = (id: string, color: string) => startTransition(() => void setStickyNoteColorAction(id, color));
  const resize = (id: string, width: number, height: number) => startTransition(() => void resizeStickyNoteAction(id, width, height));
  const toggleCollapse = (id: string, collapsed: boolean) => startTransition(() => void setStickyNoteCollapsedAction(id, collapsed));
  const remove = (id: string) => {
    if (!confirm("이 메모를 삭제할까요?")) return;
    startTransition(() => void deleteStickyNoteAction(id));
  };

  return (
    <div>
      {canWrite && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <button
            onClick={add}
            style={{
              height: 30,
              padding: "0 12px",
              border: 0,
              borderRadius: 7,
              background: "var(--accent)",
              color: "var(--on-accent)",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + 새 메모
          </button>
        </div>
      )}
      <div
        style={{
          position: "relative",
          minHeight: "70vh",
          overflow: "auto",
          border: "1px dashed var(--line)",
          borderRadius: 10,
          background: "var(--panel2)",
        }}
      >
        {notes.length === 0 && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--ink3)", fontSize: 13 }}>
            아직 메모가 없습니다. {canWrite && '"+ 새 메모"로 시작해보세요.'}
          </div>
        )}
        {notes.map((n) => (
          <NoteCard
            key={n.id}
            note={n}
            canWrite={canWrite}
            front={frontId === n.id}
            onDragStart={setFrontId}
            onMove={move}
            onSaveContent={saveContent}
            onSaveTitle={saveTitle}
            onSetColor={setColor}
            onResize={resize}
            onToggleCollapse={toggleCollapse}
            onDelete={remove}
          />
        ))}
      </div>
    </div>
  );
}

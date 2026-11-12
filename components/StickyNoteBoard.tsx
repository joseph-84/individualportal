"use client";

import { useEffect, useRef, useState, useTransition, type PointerEvent } from "react";
import {
  createStickyNoteAction,
  updateStickyNoteContentAction,
  setStickyNoteColorAction,
  moveStickyNoteAction,
  deleteStickyNoteAction,
} from "@/app/actions/sticky-notes";

interface NoteItem {
  id: string;
  content: string;
  color: string;
  x: number;
  y: number;
  z: number;
}

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
  onSetColor,
  onDelete,
}: {
  note: NoteItem;
  canWrite: boolean;
  front: boolean;
  onDragStart: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onSaveContent: (id: string, content: string) => void;
  onSetColor: (id: string, color: string) => void;
  onDelete: (id: string) => void;
}) {
  const [pos, setPos] = useState({ x: note.x, y: note.y });
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.content);
  const dragInfo = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const movedRef = useRef(false);

  useEffect(() => setPos({ x: note.x, y: note.y }), [note.x, note.y]);
  useEffect(() => setText(note.content), [note.content]);

  const palette = PALETTE[note.color] ?? PALETTE.yellow;
  const rotate = rotationFor(note.id);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!canWrite) return;
    if ((e.target as HTMLElement).closest("textarea, button")) return;
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

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        width: 170,
        minHeight: 150,
        padding: "7px 9px 10px",
        borderRadius: 3,
        background: palette.bg,
        color: palette.ink,
        boxShadow: dragging ? "0 10px 20px rgba(0,0,0,.28)" : "0 3px 8px rgba(0,0,0,.18)",
        transform: `rotate(${rotate}deg)${dragging ? " scale(1.03)" : ""}`,
        transition: dragging ? "none" : "box-shadow .15s, transform .15s",
        cursor: canWrite ? (dragging ? "grabbing" : "grab") : "default",
        zIndex: front ? 1000 : note.z,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        touchAction: "none",
        userSelect: "none",
      }}
    >
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
            onClick={() => onDelete(note.id)}
            title="삭제"
            style={{ marginLeft: "auto", border: 0, background: "transparent", color: palette.ink, opacity: 0.55, cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1 }}
          >
            ✕
          </button>
        )}
      </div>
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
    </div>
  );
}

export function StickyNoteBoard({ canWrite, notes }: { canWrite: boolean; notes: NoteItem[] }) {
  const [, startTransition] = useTransition();
  const [frontId, setFrontId] = useState<string | null>(null);

  const add = () => startTransition(() => void createStickyNoteAction());
  const move = (id: string, x: number, y: number) => startTransition(() => void moveStickyNoteAction(id, x, y));
  const saveContent = (id: string, content: string) => startTransition(() => void updateStickyNoteContentAction(id, content));
  const setColor = (id: string, color: string) => startTransition(() => void setStickyNoteColorAction(id, color));
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
            onSetColor={setColor}
            onDelete={remove}
          />
        ))}
      </div>
    </div>
  );
}

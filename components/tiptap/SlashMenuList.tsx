"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { Editor, Range } from "@tiptap/core";

export interface SlashMenuItem {
  label: string;
  icon: string;
  keywords?: string[];
  run: (ctx: { editor: Editor; range: Range }) => void;
}

export interface SlashMenuHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

/** Popup rendered via ReactRenderer from SlashCommand.ts -- `items`/`command`/etc. here are
 * the whole Tiptap SuggestionProps bag passed straight through; we only use what we need. */
const SlashMenuList = forwardRef<SlashMenuHandle, { items: SlashMenuItem[]; command: (item: SlashMenuItem) => void }>(
  function SlashMenuList({ items, command }, ref) {
    const [selected, setSelected] = useState(0);

    useEffect(() => setSelected(0), [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (items.length === 0) return false;
        if (event.key === "ArrowDown") {
          setSelected((s) => (s + 1) % items.length);
          return true;
        }
        if (event.key === "ArrowUp") {
          setSelected((s) => (s - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          command(items[selected]);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div style={{ zIndex: 9999, padding: "8px 12px", fontSize: 12.5, color: "var(--ink3)", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, boxShadow: "0 8px 20px rgba(0,0,0,.18)" }}>
          일치하는 항목이 없습니다
        </div>
      );
    }

    return (
      <div
        style={{
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: 1,
          padding: 4,
          minWidth: 180,
          maxHeight: 280,
          overflowY: "auto",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          boxShadow: "0 8px 20px rgba(0,0,0,.18)",
        }}
      >
        {items.map((item, i) => (
          <button
            key={item.label}
            type="button"
            onMouseEnter={() => setSelected(i)}
            onClick={() => command(item)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 9px",
              border: 0,
              borderRadius: 6,
              background: i === selected ? "var(--accent-soft)" : "transparent",
              color: i === selected ? "var(--accent)" : "var(--ink2)",
              fontSize: 12.5,
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <span style={{ width: 18, textAlign: "center", flex: "none" }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    );
  }
);

export { SlashMenuList };

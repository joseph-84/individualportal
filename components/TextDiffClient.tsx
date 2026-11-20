"use client";

import { useMemo, useState } from "react";
import { diffSideBySide, diffChars, type SideCell, type SideRow, type CharDiff } from "@/lib/text-diff";

const AREA_STYLE: React.CSSProperties = {
  width: "100%",
  minHeight: 160,
  padding: 10,
  background: "var(--panel2)",
  color: "var(--ink)",
  border: "1px solid var(--line)",
  borderRadius: 7,
  fontFamily: "var(--font-mono), monospace",
  fontSize: 12,
  lineHeight: 1.6,
  resize: "vertical",
};

const RED = "#e03131";
const GREEN = "#2f9e44";

const CELL_BG: Record<SideCell["type"], string> = {
  same: "transparent",
  del: "color-mix(in srgb, " + RED + " 12%, transparent)",
  add: "color-mix(in srgb, " + GREEN + " 12%, transparent)",
  pad: "repeating-linear-gradient(45deg, var(--line2) 0 5px, transparent 5px 10px)",
};

const CHAR_HIGHLIGHT: Record<"del" | "add", React.CSSProperties> = {
  del: { background: "color-mix(in srgb, " + RED + " 38%, transparent)", borderRadius: 2 },
  add: { background: "color-mix(in srgb, " + GREEN + " 38%, transparent)", borderRadius: 2 },
};

/** Renders one side of a WinMerge-style intra-line diff: unchanged characters plain,
 * only the side's own changed runs (del on the left, add on the right) highlighted --
 * the other side's runs are skipped so each pane shows just its own version of the line. */
function CharDiffText({ segs, side }: { segs: CharDiff[]; side: "del" | "add" }) {
  return (
    <>
      {segs
        .filter((s) => s.type === "same" || s.type === side)
        .map((s, idx) => (
          <span key={idx} style={s.type === "same" ? undefined : CHAR_HIGHLIGHT[side]}>
            {s.text}
          </span>
        ))}
    </>
  );
}

function Cell({ cell, side, charSegs }: { cell: SideCell; side: "left" | "right"; charSegs: CharDiff[] | null }) {
  const kind: "del" | "add" = side === "left" ? "del" : "add";
  return (
    <>
      <div
        style={{
          flex: "none",
          width: 36,
          textAlign: "center",
          padding: "1px 0",
          color: "var(--ink3)",
          fontSize: 11,
          userSelect: "none",
          background: cell.type === "del" || cell.type === "add" ? CELL_BG[cell.type] : "transparent",
        }}
      >
        {cell.num ?? ""}
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          padding: "1px 10px 1px 6px",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          background: CELL_BG[cell.type],
          textDecoration: !charSegs && cell.type === "del" ? "line-through" : !charSegs && cell.type === "add" ? "underline" : "none",
          textDecorationColor: cell.type === "del" ? RED : cell.type === "add" ? GREEN : undefined,
        }}
      >
        {charSegs ? <CharDiffText segs={charSegs} side={kind} /> : (cell.text ?? " ")}
      </div>
      {side === "left" && <div style={{ flex: "none", width: 1, background: "var(--line)" }} />}
    </>
  );
}

/** A row counts as a "modified line" (both a removal and an addition landed on the same
 * aligned row, rather than a pure insert/delete with a blank pad on the other side) exactly
 * when diffSideBySide paired a del with an add -- that's the only case char-level
 * highlighting makes sense for, since otherwise there's no counterpart line to diff against. */
function Row({ row }: { row: SideRow }) {
  const isModified = row.left.type === "del" && row.right.type === "add";
  const charSegs = useMemo(() => (isModified ? diffChars(row.left.text!, row.right.text!) : null), [isModified, row.left.text, row.right.text]);

  return (
    <div style={{ display: "flex" }}>
      <Cell cell={row.left} side="left" charSegs={charSegs} />
      <Cell cell={row.right} side="right" charSegs={charSegs} />
    </div>
  );
}

function copy(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

export function TextDiffClient() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [showDiff, setShowDiff] = useState(false);

  const rows = useMemo(() => diffSideBySide(a, b), [a, b]);
  const removals = useMemo(() => rows.filter((r) => r.left.type === "del").length, [rows]);
  const additions = useMemo(() => rows.filter((r) => r.right.type === "add").length, [rows]);
  const leftLines = a === "" ? 0 : a.split("\n").length;
  const rightLines = b === "" ? 0 : b.split("\n").length;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="textdiff-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink2)" }}>원본</div>
          <textarea
            value={a}
            onChange={(e) => {
              setA(e.target.value);
              setShowDiff(false);
            }}
            placeholder="비교할 원본 텍스트를 붙여넣으세요"
            style={AREA_STYLE}
          />
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink2)" }}>변경본</div>
          <textarea
            value={b}
            onChange={(e) => {
              setB(e.target.value);
              setShowDiff(false);
            }}
            placeholder="비교할 변경된 텍스트를 붙여넣으세요"
            style={AREA_STYLE}
          />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={() => setShowDiff(true)}
          disabled={!a && !b}
          style={{
            height: 32,
            padding: "0 16px",
            border: "1px solid var(--accent)",
            borderRadius: 7,
            background: "var(--accent)",
            color: "var(--on-accent)",
            fontSize: 12.5,
            fontWeight: 600,
            cursor: !a && !b ? "default" : "pointer",
            opacity: !a && !b ? 0.5 : 1,
          }}
        >
          비교하기
        </button>
        <button
          onClick={() => {
            setA("");
            setB("");
            setShowDiff(false);
          }}
          style={{ height: 32, padding: "0 14px", border: "1px solid var(--line)", borderRadius: 7, background: "var(--panel2)", color: "var(--ink2)", fontSize: 12.5, cursor: "pointer" }}
        >
          초기화
        </button>
        <button
          onClick={() => {
            setA(b);
            setB(a);
          }}
          title="원본/변경본 바꾸기"
          style={{ height: 32, width: 32, border: "1px solid var(--line)", borderRadius: 7, background: "var(--panel2)", color: "var(--ink2)", fontSize: 14, cursor: "pointer" }}
        >
          ⇄
        </button>
      </div>

      {showDiff && (
        <div style={{ border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden", background: "var(--panel)" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
              <span style={{ color: RED, fontSize: 15, lineHeight: 1 }}>⊖</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: RED }}>{removals} removals</span>
              <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--ink3)" }}>{leftLines} lines</span>
              <button
                onClick={() => copy(a)}
                style={{ border: 0, background: "transparent", color: "var(--ink3)", fontSize: 11.5, cursor: "pointer", textDecoration: "underline" }}
              >
                Copy
              </button>
            </div>
            <div style={{ flex: "none", width: 1, alignSelf: "stretch", background: "var(--line)" }} />
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
              <span style={{ color: GREEN, fontSize: 15, lineHeight: 1 }}>⊕</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: GREEN }}>{additions} additions</span>
              <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--ink3)" }}>{rightLines} lines</span>
              <button
                onClick={() => copy(b)}
                style={{ border: 0, background: "transparent", color: "var(--ink3)", fontSize: 11.5, cursor: "pointer", textDecoration: "underline" }}
              >
                Copy
              </button>
            </div>
          </div>
          <div style={{ borderTop: "1px solid var(--line)", maxHeight: 520, overflow: "auto", fontFamily: "var(--font-mono), monospace", fontSize: 12, lineHeight: 1.6 }}>
            {rows.length === 0 ? (
              <div style={{ padding: 14, fontSize: 12.5, color: "var(--ink3)" }}>두 텍스트가 모두 비어 있습니다.</div>
            ) : (
              rows.map((r, i) => <Row key={i} row={r} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}

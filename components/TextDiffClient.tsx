"use client";

import { useMemo, useState } from "react";
import { diffLines, diffStats, type DiffLine } from "@/lib/text-diff";

const AREA_STYLE: React.CSSProperties = {
  width: "100%",
  minHeight: 220,
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

const LINE_BG: Record<DiffLine["type"], string> = {
  same: "transparent",
  add: "color-mix(in srgb, #2f9e44 18%, transparent)",
  del: "color-mix(in srgb, #e03131 18%, transparent)",
};

const LINE_MARK: Record<DiffLine["type"], string> = { same: " ", add: "+", del: "-" };

export function TextDiffClient() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [showDiff, setShowDiff] = useState(false);

  const lines = useMemo(() => diffLines(a, b), [a, b]);
  const stats = useMemo(() => diffStats(lines), [lines]);

  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 1100 }}>
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
        {showDiff && (
          <div style={{ fontSize: 12, color: "var(--ink3)" }}>
            <span style={{ color: "#2f9e44", fontWeight: 600 }}>+{stats.added}</span>{" "}
            <span style={{ color: "#e03131", fontWeight: 600 }}>-{stats.removed}</span>
          </div>
        )}
      </div>

      {showDiff && (
        <div style={{ border: "1px solid var(--line)", borderRadius: 7, overflow: "hidden" }}>
          {lines.length === 0 ? (
            <div style={{ padding: 14, fontSize: 12.5, color: "var(--ink3)" }}>두 텍스트가 모두 비어 있습니다.</div>
          ) : (
            <pre style={{ margin: 0, maxHeight: 480, overflow: "auto", fontFamily: "var(--font-mono), monospace", fontSize: 12, lineHeight: 1.6 }}>
              {lines.map((l, i) => (
                <div key={i} style={{ display: "flex", background: LINE_BG[l.type] }}>
                  <span style={{ flex: "none", width: 22, textAlign: "center", color: "var(--ink3)", userSelect: "none" }}>{LINE_MARK[l.type]}</span>
                  <span style={{ whiteSpace: "pre-wrap", flex: 1 }}>{l.text.length ? l.text : " "}</span>
                </div>
              ))}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

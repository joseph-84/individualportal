"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveScriptAction } from "@/app/actions/scripts";

export function CodeEditor({
  files,
  selected,
  content,
  canWrite,
}: {
  files: string[];
  selected?: string;
  content: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [source, setSource] = useState(content);
  const [pending, startTransition] = useTransition();
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    setSource(content);
    setSavedMsg(null);
  }, [content, selected]);

  const save = () => {
    if (!selected) return;
    startTransition(async () => {
      await saveScriptAction(selected, source);
      setSavedMsg("저장됨");
    });
  };

  return (
    <div className="editor-grid" style={{ display: "grid", gridTemplateColumns: "196px minmax(360px,1fr)", gap: 12, alignItems: "start", overflowX: "auto" }}>
      <aside style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 10 }}>
        <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, fontWeight: 600, letterSpacing: ".1em", color: "var(--ink3)", padding: "2px 8px 8px" }}>
          SCRIPTS
        </div>
        {files.length === 0 && <div style={{ padding: "8px", fontSize: 12, color: "var(--ink3)" }}>스크립트 파일이 없습니다.</div>}
        {files.map((f) => {
          const on = f === selected;
          return (
            <button
              key={f}
              onClick={() => router.push(`/editor?file=${encodeURIComponent(f)}`)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                width: "100%",
                padding: "5px 8px",
                border: 0,
                borderRadius: 6,
                background: on ? "var(--accent-soft)" : "transparent",
                color: on ? "var(--accent)" : "var(--ink2)",
                fontFamily: "var(--font-mono), monospace",
                fontSize: 12,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ opacity: 0.6 }}>›</span>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f}</span>
            </button>
          );
        })}
      </aside>

      <section style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderBottom: "1px solid var(--line)", background: "var(--panel2)" }}>
          <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12 }}>{selected || "선택된 파일 없음"}</span>
          <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "var(--err-soft)", color: "var(--err)" }}>ADMIN ONLY</span>
          {canWrite && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
              {savedMsg && <span style={{ fontSize: 11.5, color: "var(--ok)" }}>{savedMsg}</span>}
              <button
                onClick={save}
                disabled={pending || !selected}
                style={{ height: 27, padding: "0 12px", border: 0, borderRadius: 7, background: "var(--accent)", color: "var(--on-accent)", fontSize: 12, fontWeight: 600, cursor: pending ? "default" : "pointer", opacity: pending ? 0.6 : 1 }}
              >
                {pending ? "저장 중..." : "저장"}
              </button>
            </div>
          )}
        </div>
        <textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          spellCheck={false}
          readOnly={!canWrite}
          style={{
            width: "100%",
            height: 480,
            border: 0,
            padding: "14px 16px",
            resize: "none",
            outline: "none",
            background: "var(--panel)",
            color: "var(--ink2)",
            fontFamily: "var(--font-mono), monospace",
            fontSize: 12.5,
            lineHeight: 1.85,
          }}
        />
      </section>
    </div>
  );
}

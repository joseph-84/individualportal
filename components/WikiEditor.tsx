"use client";

import { useState, useTransition } from "react";
import { marked } from "marked";
import { saveNoteAction } from "@/app/actions/wiki";

interface Props {
  noteId: string;
  path: string;
  title: string;
  content: string;
  html: string;
  updatedAt: string;
  canWrite: boolean;
}

function seg(on: boolean): [string, string] {
  return on ? ["var(--panel)", "var(--ink)"] : ["transparent", "var(--ink2)"];
}

export function WikiEditor({ noteId, path, title, content, html, updatedAt, canWrite }: Props) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [source, setSource] = useState(content);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [viewBg, viewFg] = seg(mode === "view");
  const [editBg, editFg] = seg(mode === "edit");

  const save = () => {
    startTransition(async () => {
      await saveNoteAction(noteId, source);
      setSavedAt(new Date().toLocaleTimeString("ko-KR"));
    });
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 15px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11.5, color: "var(--ink3)" }}>{path}</div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ fontSize: 11.5, color: "var(--ink3)" }}>
            {pending ? "저장 중..." : savedAt ? `${savedAt} 저장됨` : `최종 수정 ${new Date(updatedAt).toLocaleString("ko-KR")}`}
          </span>
          {canWrite && (
            <div style={{ display: "flex", padding: 2, gap: 2, border: "1px solid var(--line)", borderRadius: 7, background: "var(--panel2)" }}>
              <button
                onClick={() => setMode("view")}
                style={{ padding: "4px 11px", border: 0, borderRadius: 5, fontSize: 12, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", background: viewBg, color: viewFg }}
              >
                뷰어
              </button>
              <button
                onClick={() => setMode("edit")}
                style={{ padding: "4px 11px", border: 0, borderRadius: 5, fontSize: 12, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", background: editBg, color: editFg }}
              >
                에디터
              </button>
            </div>
          )}
        </div>
      </div>

      {mode === "view" && (
        <article style={{ padding: "26px 30px", maxWidth: 740 }}>
          <h1 style={{ margin: "0 0 16px", fontSize: 23, fontWeight: 600, letterSpacing: "-.02em" }}>{title}</h1>
          <div className="wiki-content" style={{ color: "var(--ink2)", fontSize: 14, lineHeight: 1.75 }} dangerouslySetInnerHTML={{ __html: html }} />
        </article>
      )}

      {mode === "edit" && canWrite && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
          <div style={{ borderRight: "1px solid var(--line)" }}>
            <div style={{ display: "flex", gap: 4, padding: "7px 10px", borderBottom: "1px solid var(--line2)", background: "var(--panel2)", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, color: "var(--ink3)", alignSelf: "center" }}>마크다운</span>
              <button
                onClick={save}
                disabled={pending}
                style={{ height: 26, padding: "0 12px", border: 0, borderRadius: 6, background: "var(--accent)", color: "var(--on-accent)", fontSize: 12, fontWeight: 600, cursor: pending ? "default" : "pointer", opacity: pending ? 0.6 : 1 }}
              >
                저장
              </button>
            </div>
            <textarea
              value={source}
              onChange={(e) => setSource(e.target.value)}
              spellCheck={false}
              style={{ width: "100%", height: 440, border: 0, padding: "16px 18px", resize: "none", outline: "none", background: "var(--panel)", color: "var(--ink2)", fontFamily: "var(--font-mono), monospace", fontSize: 12.5, lineHeight: 1.85 }}
            />
          </div>
          <div style={{ padding: "18px 20px", overflow: "auto", maxHeight: 480 }}>
            <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, fontWeight: 600, letterSpacing: ".1em", color: "var(--ink3)", marginBottom: 12 }}>
              PREVIEW
            </div>
            <div
              className="wiki-content"
              style={{ color: "var(--ink2)", fontSize: 13.5, lineHeight: 1.7 }}
              dangerouslySetInnerHTML={{ __html: marked.parse(source, { async: false }) as string }}
            />
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useRef, useState, useTransition } from "react";
import { marked } from "marked";
import { saveNoteAction, deleteNoteAction } from "@/app/actions/wiki";

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

const TOOLBAR: { label: string; before: string; after: string; block?: boolean }[] = [
  { label: "H1", before: "# ", after: "", block: true },
  { label: "H2", before: "## ", after: "", block: true },
  { label: "B", before: "**", after: "**" },
  { label: "I", before: "_", after: "_" },
  { label: "“ ”", before: "> ", after: "", block: true },
  { label: "</>", before: "`", after: "`" },
  { label: "표", before: "\n| 열1 | 열2 |\n| --- | --- |\n| 값1 | 값2 |\n", after: "" },
];

export function WikiEditor({ noteId, path, title, content, html, updatedAt, canWrite }: Props) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [source, setSource] = useState(content);
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [viewBg, viewFg] = seg(mode === "view");
  const [editBg, editFg] = seg(mode === "edit");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const save = () => {
    startTransition(async () => {
      await saveNoteAction(noteId, source);
      setSavedAt(new Date().toLocaleTimeString("ko-KR"));
    });
  };

  const insert = (before: string, after: string, block?: boolean) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = source.slice(start, end);
    const needsNewlineBefore = block && start > 0 && source[start - 1] !== "\n";
    const prefix = needsNewlineBefore ? "\n" : "";
    const next = source.slice(0, start) + prefix + before + selected + after + source.slice(end);
    setSource(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + prefix.length + before.length + selected.length + after.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const remove = () => {
    if (!confirm(`"${title}" 문서를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    startDelete(() => deleteNoteAction(noteId));
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
            <>
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
              <button
                onClick={remove}
                disabled={deleting}
                title="문서 삭제"
                style={{ height: 26, padding: "0 10px", border: "1px solid var(--err)", borderRadius: 6, background: "var(--err-soft)", color: "var(--err)", fontSize: 11.5, cursor: deleting ? "default" : "pointer" }}
              >
                {deleting ? "삭제 중..." : "삭제"}
              </button>
            </>
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
              <div style={{ display: "flex", gap: 4 }}>
                {TOOLBAR.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => insert(t.before, t.after, t.block)}
                    style={{ minWidth: 26, height: 24, padding: "0 7px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink2)", fontFamily: "var(--font-mono), monospace", fontSize: 11.5, cursor: "pointer" }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <button
                onClick={save}
                disabled={pending}
                style={{ height: 26, padding: "0 12px", border: 0, borderRadius: 6, background: "var(--accent)", color: "var(--on-accent)", fontSize: 12, fontWeight: 600, cursor: pending ? "default" : "pointer", opacity: pending ? 0.6 : 1 }}
              >
                저장
              </button>
            </div>
            <textarea
              ref={textareaRef}
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

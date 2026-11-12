"use client";

import { useRef, useState } from "react";
import { RichDocEditor } from "./RichDocEditor";

const MD_TOOLBAR: { label: string; before: string; after: string; block?: boolean; extra?: boolean }[] = [
  { label: "H1", before: "# ", after: "", block: true },
  { label: "H2", before: "## ", after: "", block: true },
  { label: "B", before: "**", after: "**" },
  { label: "I", before: "_", after: "_" },
  { label: "“ ”", before: "> ", after: "", block: true },
  { label: "</>", before: "`", after: "`" },
  { label: "표", before: "\n| 열1 | 열2 |\n| --- | --- |\n| 값1 | 값2 |\n", after: "", extra: true },
];

/** Shared editor for a disk .md/.html file. The caller (FilesBrowser) owns source/save/delete;
 * this component only knows how to show and edit document content. Opening a document always
 * shows it ready to edit (RichDocEditor, WYSIWYG) when `canWrite` -- there's no separate
 * viewer/editor mode anymore. A read-only user gets the server-rendered `html` instead. A
 * secondary "원문" toggle switches to a plain raw-source textarea (the underlying markdown or
 * HTML text) for power users; toggling back remounts RichDocEditor with that raw text as its
 * new starting content (Tiptap only reads its `content` once at mount, so a key bump forces
 * the remount). */
export function DocEditor({
  canWrite,
  title,
  format,
  html,
  source,
  onSourceChange,
}: {
  canWrite: boolean;
  title: string;
  format: string; // "md" | "html"
  html: string;
  source: string;
  onSourceChange: (next: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [rawMode, setRawMode] = useState(false);
  const [richKey, setRichKey] = useState(0);

  const insert = (before: string, after: string, block?: boolean) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = source.slice(start, end);
    const needsNewlineBefore = block && start > 0 && source[start - 1] !== "\n";
    const prefix = needsNewlineBefore ? "\n" : "";
    const next = source.slice(0, start) + prefix + before + selected + after + source.slice(end);
    onSourceChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + prefix.length + before.length + selected.length + after.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const toggleRawMode = () => {
    if (rawMode) setRichKey((k) => k + 1); // leaving raw mode: remount the rich editor with the edited raw text
    setRawMode((v) => !v);
  };

  return (
    <>
      {canWrite && (
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 20px 0" }}>
          <button
            type="button"
            onClick={toggleRawMode}
            style={{ height: 24, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: rawMode ? "var(--accent-soft)" : "var(--panel2)", color: rawMode ? "var(--accent)" : "var(--ink2)", fontSize: 11.5, cursor: "pointer" }}
          >
            {rawMode ? "리치 편집으로" : "원문 보기/편집"}
          </button>
        </div>
      )}

      {!canWrite && (
        <article style={{ padding: "26px 30px", maxWidth: format === "html" ? "none" : 740, overflowX: "auto" }}>
          <h1 style={{ margin: "0 0 16px", fontSize: 23, fontWeight: 600, letterSpacing: "-.02em" }}>{title}</h1>
          <div className="wiki-content" style={{ color: "var(--ink2)", fontSize: 14, lineHeight: 1.75 }} dangerouslySetInnerHTML={{ __html: html }} />
        </article>
      )}

      {canWrite && !rawMode && (
        <div style={{ padding: "12px 20px 18px" }}>
          <RichDocEditor key={richKey} format={format === "md" ? "md" : "html"} defaultValue={source} onChange={onSourceChange} />
        </div>
      )}

      {canWrite && rawMode && (
        <div style={{ padding: "0 20px 18px" }}>
          {format === "md" && (
            <div style={{ display: "flex", gap: 4, padding: "7px 10px", border: "1px solid var(--line)", borderBottom: 0, borderRadius: "6px 6px 0 0", background: "var(--panel2)" }}>
              {MD_TOOLBAR.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  className={t.extra ? "wiki-toolbar-extra" : undefined}
                  onClick={() => insert(t.before, t.after, t.block)}
                  style={{ minWidth: 26, height: 24, padding: "0 7px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink2)", fontFamily: "var(--font-mono), monospace", fontSize: 11.5, cursor: "pointer" }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={source}
            onChange={(e) => onSourceChange(e.target.value)}
            spellCheck={false}
            style={{
              width: "100%",
              height: 440,
              border: "1px solid var(--line)",
              borderTop: format === "md" ? 0 : "1px solid var(--line)",
              borderRadius: format === "md" ? "0 0 6px 6px" : 6,
              padding: "16px 18px",
              resize: "none",
              outline: "none",
              background: "var(--panel)",
              color: "var(--ink2)",
              fontFamily: "var(--font-mono), monospace",
              fontSize: 12.5,
              lineHeight: 1.85,
            }}
          />
        </div>
      )}
    </>
  );
}

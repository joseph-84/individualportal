"use client";

import { useRef } from "react";
import { marked } from "marked";
import { WikiHtmlEditor } from "./WikiHtmlEditor";

const MD_TOOLBAR: { label: string; before: string; after: string; block?: boolean; extra?: boolean }[] = [
  { label: "H1", before: "# ", after: "", block: true },
  { label: "H2", before: "## ", after: "", block: true },
  { label: "B", before: "**", after: "**" },
  { label: "I", before: "_", after: "_" },
  { label: "“ ”", before: "> ", after: "", block: true },
  { label: "</>", before: "`", after: "`" },
  { label: "표", before: "\n| 열1 | 열2 |\n| --- | --- |\n| 값1 | 값2 |\n", after: "", extra: true },
];

/** Shared viewer/editor for a disk .md/.html file, rendered through lib/markdown.ts's
 * renderNote. The caller (FilesBrowser) owns mode/source/save/delete; this component only
 * knows how to show and edit document content. */
export function DocEditor({
  mode,
  title,
  format,
  html,
  source,
  onSourceChange,
  mobilePreviewOpen,
  onCloseMobilePreview,
}: {
  mode: "view" | "edit";
  title: string;
  format: string; // "md" | "html"
  html: string;
  source: string;
  onSourceChange: (next: string) => void;
  mobilePreviewOpen: boolean;
  onCloseMobilePreview: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const livePreviewHtml = mode === "edit" && format === "md" ? (marked.parse(source, { async: false }) as string) : "";

  return (
    <>
      {mode === "view" && (
        <article style={{ padding: "26px 30px", maxWidth: format === "html" ? "none" : 740, overflowX: "auto" }}>
          <h1 style={{ margin: "0 0 16px", fontSize: 23, fontWeight: 600, letterSpacing: "-.02em" }}>{title}</h1>
          <div className="wiki-content" style={{ color: "var(--ink2)", fontSize: 14, lineHeight: 1.75 }} dangerouslySetInnerHTML={{ __html: html }} />
        </article>
      )}

      {mode === "edit" && format === "html" && (
        <div style={{ padding: "18px 20px" }}>
          <WikiHtmlEditor defaultValue={source} onChange={onSourceChange} />
        </div>
      )}

      {mode === "edit" && format === "md" && (
        <div className="wiki-editor-split" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
          <div style={{ borderRight: "1px solid var(--line)" }}>
            <div style={{ display: "flex", gap: 4, padding: "7px 10px", borderBottom: "1px solid var(--line2)", background: "var(--panel2)" }}>
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
            <textarea
              ref={textareaRef}
              value={source}
              onChange={(e) => onSourceChange(e.target.value)}
              spellCheck={false}
              style={{ width: "100%", height: 440, border: 0, padding: "16px 18px", resize: "none", outline: "none", background: "var(--panel)", color: "var(--ink2)", fontFamily: "var(--font-mono), monospace", fontSize: 12.5, lineHeight: 1.85 }}
            />
          </div>
          <div className="wiki-preview-pane" style={{ padding: "18px 20px", overflow: "auto", maxHeight: 480 }}>
            <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, fontWeight: 600, letterSpacing: ".1em", color: "var(--ink3)", marginBottom: 12 }}>
              PREVIEW
            </div>
            <div className="wiki-content" style={{ color: "var(--ink2)", fontSize: 13.5, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: livePreviewHtml }} />
          </div>
        </div>
      )}

      {mobilePreviewOpen && (
        <div
          className="wiki-mobile-preview-backdrop"
          onClick={onCloseMobilePreview}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 80, display: "flex", alignItems: "flex-end" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--panel)", borderRadius: "14px 14px 0 0", width: "100%", maxHeight: "82vh", overflow: "auto", boxShadow: "0 -8px 28px rgba(0,0,0,.3)" }}
          >
            <div style={{ position: "sticky", top: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid var(--line)", background: "var(--panel)" }}>
              <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, fontWeight: 600, letterSpacing: ".1em", color: "var(--ink3)" }}>PREVIEW</span>
              <button
                onClick={onCloseMobilePreview}
                style={{ width: 26, height: 26, border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink2)", fontSize: 13, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: "16px 18px 28px" }}>
              <div className="wiki-content" style={{ color: "var(--ink2)", fontSize: 13.5, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: livePreviewHtml }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

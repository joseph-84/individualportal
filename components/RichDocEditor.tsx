"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { TableKit } from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Markdown } from "@tiptap/markdown";
import { SlashCommand, type SlashMenuItem } from "./tiptap/SlashCommand";
import { DOC_SLASH_ITEMS } from "./tiptap/items";

const BTN_STYLE = (active: boolean): React.CSSProperties => ({
  minWidth: 26,
  height: 25,
  padding: "0 7px",
  border: "1px solid var(--line)",
  borderRadius: 5,
  background: active ? "var(--accent-soft)" : "var(--panel)",
  color: active ? "var(--accent)" : "var(--ink2)",
  fontSize: 12,
  cursor: "pointer",
  flex: "none",
});

/** Rich-text editor shared by the file browser's .md/.html documents, the checklist editor,
 * and sticky-note content. Replaces the old HTML-only WikiHtmlEditor: `format="md"` round-trips
 * through @tiptap/markdown (editor.getMarkdown()) instead of editor.getHTML(), using the exact
 * same extension set -- @tiptap/extension-table@3.33.1+ ships its own markdown serializer, so
 * tables survive the .md round-trip too, no special-casing needed. Typing "/" opens a block
 * menu (SlashCommand); "# ", "- ", "1. ", "> ", "[] " etc. already work via StarterKit/TaskItem's
 * built-in input rules. `defaultValue` is only used on initial mount (Tiptap's useEditor ignores
 * later `content` prop changes) -- callers that need to push in a different value later (e.g.
 * toggling out of raw-source mode) should remount with a new `key`. */
export function RichDocEditor({
  format = "html",
  defaultValue,
  onChange,
  onBlur,
  editable = true,
  slashItems = DOC_SLASH_ITEMS,
  compact = false,
  hideToolbar = false,
  bare = false,
}: {
  format?: "html" | "md";
  defaultValue: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  editable?: boolean;
  slashItems?: SlashMenuItem[];
  compact?: boolean;
  hideToolbar?: boolean;
  /** Drop the editor's own border/background/padding so it blends into a caller-styled
   * container (e.g. a colored sticky note) instead of looking like a nested panel. */
  bare?: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      Highlight,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TableKit.configure({ table: { resizable: false } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Markdown,
      SlashCommand.configure({ items: slashItems }),
    ],
    content: defaultValue || "",
    contentType: format === "md" ? "markdown" : undefined,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "wiki-content rich-text-editable" },
    },
    onUpdate: ({ editor }) => onChange(format === "md" ? editor.getMarkdown() : editor.getHTML()),
    onBlur: onBlur ? ({ editor }) => onBlur(format === "md" ? editor.getMarkdown() : editor.getHTML()) : undefined,
  });

  if (!editor) {
    return <div style={{ height: compact ? 90 : 300, border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel)" }} />;
  }

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("링크 URL", prev || "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const setImage = () => {
    const url = window.prompt("이미지 URL");
    if (!url || !url.trim()) return;
    editor.chain().focus().setImage({ src: url.trim() }).run();
  };

  const inTable = editor.isActive("table");

  return (
    <div style={bare ? undefined : { border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel)", overflow: "hidden" }}>
      {editable && !hideToolbar && (
        <div className="wiki-html-toolbar" style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "7px 8px", borderBottom: "1px solid var(--line)", background: "var(--panel2)" }}>
          <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} style={BTN_STYLE(editor.isActive("heading", { level: 1 }))} title="제목1">
            H1
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} style={BTN_STYLE(editor.isActive("heading", { level: 2 }))} title="제목2">
            H2
          </button>
          <button type="button" className="wiki-toolbar-extra" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} style={BTN_STYLE(editor.isActive("heading", { level: 3 }))} title="제목3">
            H3
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} style={BTN_STYLE(editor.isActive("bold"))} title="굵게">
            <b>B</b>
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} style={BTN_STYLE(editor.isActive("italic"))} title="기울임">
            <i>I</i>
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} style={BTN_STYLE(editor.isActive("underline"))} title="밑줄">
            <u>U</u>
          </button>
          <button type="button" className="wiki-toolbar-extra" onClick={() => editor.chain().focus().toggleStrike().run()} style={BTN_STYLE(editor.isActive("strike"))} title="취소선">
            <s>S</s>
          </button>
          {!compact && (
            <button type="button" className="wiki-toolbar-extra" onClick={() => editor.chain().focus().toggleHighlight().run()} style={BTN_STYLE(editor.isActive("highlight"))} title="형광펜">
              ▌형광펜
            </button>
          )}
          <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} style={BTN_STYLE(editor.isActive("bulletList"))} title="불렛 목록">
            • 목록
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} style={BTN_STYLE(editor.isActive("orderedList"))} title="번호 매기기">
            1. 목록
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleTaskList().run()} style={BTN_STYLE(editor.isActive("taskList"))} title="체크박스">
            ☑ 체크
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} style={BTN_STYLE(editor.isActive("blockquote"))} title="인용구">
            “ ”
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} style={BTN_STYLE(editor.isActive("codeBlock"))} title="코드 블록">
            {"</>"}
          </button>
          <button type="button" onClick={setLink} style={BTN_STYLE(editor.isActive("link"))} title="링크">
            🔗
          </button>
          {!compact && (
            <>
              <button type="button" className="wiki-toolbar-extra" onClick={setImage} style={BTN_STYLE(false)} title="이미지 (URL)">
                🖼
              </button>
              <button
                type="button"
                className="wiki-toolbar-extra"
                onClick={() => editor.chain().focus().setTextAlign("left").run()}
                style={BTN_STYLE(editor.isActive({ textAlign: "left" }))}
                title="왼쪽 정렬"
              >
                ⟸
              </button>
              <button
                type="button"
                className="wiki-toolbar-extra"
                onClick={() => editor.chain().focus().setTextAlign("center").run()}
                style={BTN_STYLE(editor.isActive({ textAlign: "center" }))}
                title="가운데 정렬"
              >
                ⟺
              </button>
              <button
                type="button"
                className="wiki-toolbar-extra"
                onClick={() => editor.chain().focus().setTextAlign("right").run()}
                style={BTN_STYLE(editor.isActive({ textAlign: "right" }))}
                title="오른쪽 정렬"
              >
                ⟹
              </button>
              <button type="button" className="wiki-toolbar-extra" onClick={() => editor.chain().focus().setHorizontalRule().run()} style={BTN_STYLE(false)} title="구분선">
                ―
              </button>
              {!inTable && (
                <button
                  type="button"
                  className="wiki-toolbar-extra"
                  onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                  style={BTN_STYLE(false)}
                  title="표 삽입"
                >
                  표
                </button>
              )}
              {inTable && (
                <>
                  <button type="button" className="wiki-toolbar-extra" onClick={() => editor.chain().focus().addRowAfter().run()} style={BTN_STYLE(false)} title="행 추가">
                    +행
                  </button>
                  <button type="button" className="wiki-toolbar-extra" onClick={() => editor.chain().focus().addColumnAfter().run()} style={BTN_STYLE(false)} title="열 추가">
                    +열
                  </button>
                  <button type="button" className="wiki-toolbar-extra" onClick={() => editor.chain().focus().deleteRow().run()} style={BTN_STYLE(false)} title="행 삭제">
                    -행
                  </button>
                  <button type="button" className="wiki-toolbar-extra" onClick={() => editor.chain().focus().deleteColumn().run()} style={BTN_STYLE(false)} title="열 삭제">
                    -열
                  </button>
                  <button type="button" className="wiki-toolbar-extra" onClick={() => editor.chain().focus().deleteTable().run()} style={BTN_STYLE(false)} title="표 삭제">
                    표✕
                  </button>
                </>
              )}
            </>
          )}
          <button type="button" onClick={() => editor.chain().focus().undo().run()} style={BTN_STYLE(false)} title="실행 취소">
            ↺
          </button>
          <button type="button" onClick={() => editor.chain().focus().redo().run()} style={BTN_STYLE(false)} title="다시 실행">
            ↻
          </button>
        </div>
      )}
      <EditorContent
        editor={editor}
        style={{
          padding: bare ? 0 : compact ? "10px 12px" : "18px 20px",
          minHeight: compact ? 70 : 380,
          maxHeight: compact ? 220 : 620,
          overflowY: "auto",
          color: bare ? "inherit" : "var(--ink2)",
          fontSize: compact ? 13 : 14,
          lineHeight: compact ? 1.4 : 1.75,
        }}
      />
    </div>
  );
}

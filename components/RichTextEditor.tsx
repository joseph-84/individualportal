"use client";

import { useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";

const BTN_STYLE = (active: boolean): React.CSSProperties => ({
  minWidth: 26,
  height: 24,
  padding: "0 7px",
  border: "1px solid var(--line)",
  borderRadius: 5,
  background: active ? "var(--accent-soft)" : "var(--panel)",
  color: active ? "var(--accent)" : "var(--ink2)",
  fontSize: 12,
  cursor: "pointer",
});

/** A compact Notion/Confluence-style rich text editor for todo descriptions (bold/italic,
 * bullet/numbered lists, task checkboxes). Submits its HTML via a hidden input so it works
 * with the existing plain `<form action={...}>` server-action pattern.
 *
 * The hidden input is uncontrolled (imperatively updated via a ref inside onUpdate) rather
 * than React-state-controlled -- checking a task-item checkbox dispatches its transaction
 * from a raw DOM listener the NodeView adds itself (outside JSX/React's synthetic event
 * path), and going through this ref avoids depending on a state+re-render round trip to
 * land before the surrounding form submits. */
export function RichTextEditor({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: defaultValue || "",
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "wiki-content rich-text-content rich-text-editable" },
    },
    onUpdate: ({ editor }) => {
      if (hiddenInputRef.current) hiddenInputRef.current.value = editor.getHTML();
    },
  });

  if (!editor) {
    return <div style={{ height: 96, border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel)" }} />;
  }

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel)", overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 4, padding: "6px 8px", borderBottom: "1px solid var(--line)", background: "var(--panel2)" }}>
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} style={BTN_STYLE(editor.isActive("bold"))} title="굵게">
          <b>B</b>
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} style={BTN_STYLE(editor.isActive("italic"))} title="기울임">
          <i>I</i>
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} style={BTN_STYLE(editor.isActive("bulletList"))} title="불렛 목록">
          • 목록
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} style={BTN_STYLE(editor.isActive("orderedList"))} title="번호 매기기">
          1. 목록
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleTaskList().run()} style={BTN_STYLE(editor.isActive("taskList"))} title="체크박스">
          ☑ 체크박스
        </button>
      </div>
      <EditorContent editor={editor} style={{ padding: "8px 10px", minHeight: 80, maxHeight: 260, overflowY: "auto", fontSize: 12.5 }} />
      <input ref={hiddenInputRef} type="hidden" name={name} defaultValue={defaultValue || ""} />
    </div>
  );
}

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

/** GUI 위지위그 도구 -- 지식베이스(위키) HTML 문서 작성용. 원시 HTML 태그를 직접 입력하지 않고도
 * 제목/서식/목록/체크박스/인용/코드/링크/이미지/표/정렬/구분선까지 대부분의 문서 구조를 만들 수
 * 있게 한다 (SVG 다이어그램 등 완전 자유 형식 HTML은 범위 밖 -- 필요하면 여전히 저장된 content를
 * 직접 편집할 수 있음). `defaultValue`는 최초 마운트 시에만 쓰이고(Tiptap의 useEditor는 이후
 * content prop 변경을 무시함) 이후 변경은 매 입력마다 onChange로 부모 상태에 반영한다 -- 에디터
 * 탭을 떠났다가(뷰어 전환) 다시 돌아와 이 컴포넌트가 재마운트돼도 저장 전 입력을 잃지 않기 위함. */
export function WikiHtmlEditor({ defaultValue, onChange }: { defaultValue: string; onChange: (html: string) => void }) {
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
    ],
    content: defaultValue || "",
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "wiki-content rich-text-editable" },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) {
    return <div style={{ height: 300, border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel)" }} />;
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
    <div style={{ border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel)", overflow: "hidden" }}>
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
        <button type="button" className="wiki-toolbar-extra" onClick={() => editor.chain().focus().toggleHighlight().run()} style={BTN_STYLE(editor.isActive("highlight"))} title="형광펜">
          ▌형광펜
        </button>
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
        <button type="button" onClick={() => editor.chain().focus().undo().run()} style={BTN_STYLE(false)} title="실행 취소">
          ↺
        </button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} style={BTN_STYLE(false)} title="다시 실행">
          ↻
        </button>
      </div>
      <EditorContent editor={editor} style={{ padding: "18px 20px", minHeight: 380, maxHeight: 620, overflowY: "auto", color: "var(--ink2)", fontSize: 14, lineHeight: 1.75 }} />
    </div>
  );
}

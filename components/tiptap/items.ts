import type { SlashMenuItem } from "./SlashCommand";

/** Full block set for file-browser documents (.md/.html) -- table included since
 * @tiptap/extension-table@3.33.1 ships its own parseMarkdown/renderMarkdown/markdownTokenizer,
 * so a table round-trips cleanly through .md too. */
export const DOC_SLASH_ITEMS: SlashMenuItem[] = [
  { label: "제목 1", icon: "H1", keywords: ["heading", "제목"], run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run() },
  { label: "제목 2", icon: "H2", keywords: ["heading", "제목"], run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run() },
  { label: "제목 3", icon: "H3", keywords: ["heading", "제목"], run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run() },
  { label: "글머리 목록", icon: "•", keywords: ["bullet", "list", "목록"], run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run() },
  { label: "번호 목록", icon: "1.", keywords: ["ordered", "number", "목록"], run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run() },
  { label: "체크박스", icon: "☑", keywords: ["todo", "task", "check", "체크"], run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run() },
  { label: "인용", icon: "“ ”", keywords: ["quote", "인용"], run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run() },
  { label: "코드 블록", icon: "</>", keywords: ["code"], run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run() },
  { label: "구분선", icon: "―", keywords: ["divider", "hr", "구분"], run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run() },
  { label: "표", icon: "▦", keywords: ["table", "표"], run: ({ editor, range }) => editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
];

/** Lighter set for a sticky-note-sized memo: no table/code block, just the quick structuring
 * blocks a short note actually needs. */
export const MEMO_SLASH_ITEMS: SlashMenuItem[] = DOC_SLASH_ITEMS.filter((item) => !["표", "코드 블록"].includes(item.label));

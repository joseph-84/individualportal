"use client";

import { useEffect, useMemo, useState, useTransition, useActionState } from "react";
import {
  createTodoAction,
  deleteTodoAction,
  editTodoAction,
  reorderTodoAction,
  moveTodoAction,
  toggleDescriptionCheckboxAction,
  type EditTodoState,
} from "@/app/actions/todos";
import { TodoCheckbox } from "./TodoCheckbox";
import { RichTextEditor } from "./RichTextEditor";

interface TodoItem {
  id: string;
  title: string;
  description: string | null;
  descriptionHtml: string | null;
  project: string | null;
  repeat: string | null;
  tag: string;
  status: string;
  order: number;
  parentId: string | null;
  dueAt: string | null;
}

const CHIP: Record<string, [string, string]> = {
  업무: ["var(--accent-soft)", "var(--accent)"],
  반복: ["var(--ok-soft)", "var(--ok)"],
  개인: ["var(--panel3)", "var(--ink2)"],
  마감: ["var(--err-soft)", "var(--err)"],
};

const STATUS_COLUMNS = [
  { key: "todo", label: "할 일" },
  { key: "in_progress", label: "진행중" },
  { key: "done", label: "완료" },
] as const;
const STATUS_LABEL: Record<string, string> = { todo: "할 일", in_progress: "진행중", done: "완료" };
const STATUS_BADGE: Record<string, [string, string]> = {
  in_progress: ["var(--warn-soft)", "var(--warn)"],
};

function seg(on: boolean): [string, string] {
  return on ? ["var(--panel)", "var(--ink)"] : ["transparent", "var(--ink2)"];
}

const FILTERS = ["전체", "오늘", "이번 주", "반복만"] as const;
type Filter = (typeof FILTERS)[number];

const VIEW_STORAGE_KEY = "portal-todos-view";
type TodoView = "list" | "cal" | "kanban";
function isTodoView(v: string | null): v is TodoView {
  return v === "list" || v === "cal" || v === "kanban";
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function StatusSelect({ defaultValue }: { defaultValue: string }) {
  return (
    <select name="status" defaultValue={defaultValue} style={{ height: 30, border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel)", color: "var(--ink)", fontSize: 12.5 }}>
      {STATUS_COLUMNS.map((s) => (
        <option key={s.key} value={s.key}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

const initialEdit: EditTodoState = {};

function EditTodoForm({ todo, onDone }: { todo: TodoItem; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(async (_prev: EditTodoState, fd: FormData) => {
    const res = await editTodoAction(_prev, fd);
    if (!res.error) onDone();
    return res;
  }, initialEdit);

  return (
    <form action={formAction} style={{ display: "grid", gap: 8, padding: 12, background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: 8, marginTop: 4, marginBottom: 4 }}>
      <input type="hidden" name="id" value={todo.id} />
      <input name="title" defaultValue={todo.title} required placeholder="제목" style={{ height: 30, padding: "0 9px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel)", color: "var(--ink)", fontSize: 12.5 }} />
      <RichTextEditor name="description" defaultValue={todo.description || ""} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input name="project" defaultValue={todo.project || ""} placeholder="프로젝트" style={{ width: 120, height: 30, padding: "0 9px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel)", color: "var(--ink)", fontSize: 12.5 }} />
        <input name="dueAt" type="date" defaultValue={todo.dueAt ? todo.dueAt.slice(0, 10) : ""} style={{ height: 30, padding: "0 9px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel)", color: "var(--ink)", fontSize: 12.5 }} />
        <input name="repeat" defaultValue={todo.repeat || ""} placeholder="반복 (예: 매일)" style={{ width: 110, height: 30, padding: "0 9px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel)", color: "var(--ink)", fontSize: 12.5 }} />
        <select name="tag" defaultValue={todo.tag} style={{ height: 30, border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel)", color: "var(--ink)", fontSize: 12.5 }}>
          <option value="업무">업무</option>
          <option value="반복">반복</option>
          <option value="개인">개인</option>
          <option value="마감">마감</option>
        </select>
        <StatusSelect defaultValue={todo.status} />
      </div>
      {state.error && <div style={{ fontSize: 12, color: "var(--err)" }}>{state.error}</div>}
      <div style={{ display: "flex", gap: 6 }}>
        <button type="submit" disabled={pending} style={{ height: 30, padding: "0 14px", border: 0, borderRadius: 6, background: "var(--accent)", color: "var(--on-accent)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
          {pending ? "저장 중..." : "저장"}
        </button>
        <button type="button" onClick={onDone} style={{ height: 30, padding: "0 14px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel)", color: "var(--ink2)", fontSize: 12.5, cursor: "pointer" }}>
          취소
        </button>
      </div>
    </form>
  );
}

interface DragState {
  id: string;
  parentId: string | null;
}

/** Event-delegation click handler for a description block rendered via dangerouslySetInnerHTML:
 * if the click landed on a task-item checkbox, figures out its index among all checkboxes in
 * this description and persists the toggle. The browser's own native checkbox behavior handles
 * the immediate visual flip; the server action + revalidatePath reconciles it afterward. */
function handleDescriptionClick(e: React.MouseEvent<HTMLDivElement>, todoId: string, canWrite: boolean, startTransition: (cb: () => void) => void) {
  if (!canWrite) return;
  const target = e.target as HTMLElement;
  if (target.tagName !== "INPUT" || (target as HTMLInputElement).type !== "checkbox") return;
  const checkboxes = Array.from(e.currentTarget.querySelectorAll('input[type="checkbox"]'));
  const idx = checkboxes.indexOf(target as HTMLInputElement);
  if (idx === -1) return;
  startTransition(() => toggleDescriptionCheckboxAction(todoId, idx));
}

function TodoRow({
  todo,
  depth,
  byParent,
  canWrite,
  editingId,
  setEditingId,
  addingParentId,
  setAddingParentId,
  dragged,
  setDragged,
  dropTarget,
  setDropTarget,
  onDrop,
}: {
  todo: TodoItem;
  depth: number;
  byParent: Map<string, TodoItem[]>;
  canWrite: boolean;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  addingParentId: string | null;
  setAddingParentId: (id: string | null) => void;
  dragged: DragState | null;
  setDragged: (d: DragState | null) => void;
  dropTarget: { id: string; pos: "before" | "after" } | null;
  setDropTarget: (d: { id: string; pos: "before" | "after" } | null) => void;
  onDrop: (targetId: string, pos: "before" | "after") => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [dragArmed, setDragArmed] = useState(false);
  const [, startTransition] = useTransition();
  const [tagBg, tagFg] = CHIP[todo.tag] || CHIP.개인;
  const done = todo.status === "done";
  const editing = editingId === todo.id;
  const adding = addingParentId === todo.id;
  const children = byParent.get(todo.id) || [];

  const canAcceptDrop = canWrite && dragged && dragged.parentId === (todo.parentId ?? null) && dragged.id !== todo.id;
  const showTopLine = canAcceptDrop && dropTarget?.id === todo.id && dropTarget.pos === "before";
  const showBottomLine = canAcceptDrop && dropTarget?.id === todo.id && dropTarget.pos === "after";

  return (
    <div style={{ borderBottom: depth === 0 ? "1px solid var(--line2)" : "none" }}>
      <div
        draggable={canWrite && dragArmed}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          setDragged({ id: todo.id, parentId: todo.parentId ?? null });
        }}
        onDragEnd={() => {
          setDragArmed(false);
          setDragged(null);
          setDropTarget(null);
        }}
        onDragOver={(e) => {
          if (!canAcceptDrop) return;
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const pos = e.clientY - rect.top < rect.height / 2 ? "before" : "after";
          if (dropTarget?.id !== todo.id || dropTarget.pos !== pos) setDropTarget({ id: todo.id, pos });
        }}
        onDrop={(e) => {
          if (!canAcceptDrop || !dropTarget) return;
          e.preventDefault();
          onDrop(todo.id, dropTarget.pos);
        }}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          padding: "9px 15px",
          paddingLeft: 15 + depth * 22,
          borderTop: showTopLine ? "2px solid var(--accent)" : "2px solid transparent",
          borderBottom: showBottomLine ? "2px solid var(--accent)" : undefined,
          opacity: dragged?.id === todo.id ? 0.4 : 1,
        }}
      >
        {canWrite && (
          <span
            onMouseDown={() => setDragArmed(true)}
            onMouseUp={() => setDragArmed(false)}
            style={{ width: 10, flex: "none", color: "var(--ink3)", fontSize: 11, marginTop: 2, cursor: "grab", userSelect: "none" }}
            title="드래그해서 순서 변경"
          >
            ⠿
          </span>
        )}
        {children.length > 0 ? (
          <button onClick={() => setCollapsed((v) => !v)} style={{ width: 16, height: 20, border: 0, background: "transparent", color: "var(--ink3)", cursor: "pointer", fontSize: 10, flex: "none" }}>
            {collapsed ? "▸" : "▾"}
          </button>
        ) : (
          <span style={{ width: 16, flex: "none" }} />
        )}
        <div style={{ marginTop: 2 }}>
          <TodoCheckbox id={todo.id} done={done} canWrite={canWrite} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: done ? "var(--ink3)" : "var(--ink)", textDecoration: done ? "line-through" : "none" }}>{todo.title}</div>
          {todo.descriptionHtml && (
            <div
              className="wiki-content rich-text-content"
              style={{ fontSize: 11.5, color: "var(--ink3)", marginTop: 2 }}
              onClick={(e) => handleDescriptionClick(e, todo.id, canWrite, startTransition)}
              dangerouslySetInnerHTML={{ __html: todo.descriptionHtml }}
            />
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 3, fontSize: 11, color: "var(--ink3)", fontFamily: "var(--font-mono), monospace" }}>
            {todo.project && <span>{todo.project}</span>}
            {todo.dueAt && <span>{new Date(todo.dueAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}</span>}
            {todo.repeat && <span>↻{todo.repeat}</span>}
          </div>
        </div>
        {STATUS_BADGE[todo.status] && (
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 500,
              padding: "2px 8px",
              borderRadius: 999,
              background: STATUS_BADGE[todo.status][0],
              color: STATUS_BADGE[todo.status][1],
              flex: "none",
            }}
          >
            {STATUS_LABEL[todo.status]}
          </span>
        )}
        <span style={{ fontSize: 10.5, fontWeight: 500, padding: "2px 8px", borderRadius: 999, background: tagBg, color: tagFg, flex: "none" }}>{todo.tag}</span>
        {canWrite && (
          <div style={{ display: "flex", gap: 4, flex: "none" }}>
            <button onClick={() => setAddingParentId(adding ? null : todo.id)} title="하위 할일 추가" style={{ width: 22, height: 22, border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink2)", cursor: "pointer", fontSize: 12 }}>
              +
            </button>
            <button onClick={() => setEditingId(editing ? null : todo.id)} title="편집" style={{ width: 22, height: 22, border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink2)", cursor: "pointer", fontSize: 11 }}>
              ✎
            </button>
            <button
              onClick={() => confirm(`"${todo.title}"을(를) 삭제할까요?${children.length ? " 하위 할일도 함께 삭제됩니다." : ""}`) && startTransition(() => deleteTodoAction(todo.id))}
              title="삭제"
              style={{ width: 22, height: 22, border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink3)", cursor: "pointer", fontSize: 11 }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {editing && (
        <div style={{ paddingLeft: 15 + depth * 22, paddingRight: 15 }}>
          <EditTodoForm todo={todo} onDone={() => setEditingId(null)} />
        </div>
      )}

      {adding && (
        <div style={{ paddingLeft: 15 + (depth + 1) * 22, paddingRight: 15 }}>
          <form
            action={(fd) => {
              startTransition(() => createTodoAction(fd));
              setAddingParentId(null);
            }}
            style={{ display: "flex", gap: 6, padding: 10, background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: 8, marginBottom: 6, flexWrap: "wrap" }}
          >
            <input type="hidden" name="parentId" value={todo.id} />
            <input name="title" placeholder="하위 할일 제목" required autoFocus style={{ flex: 1, minWidth: 140, height: 28, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink)", fontSize: 12 }} />
            <button type="submit" style={{ height: 28, padding: "0 12px", border: 0, borderRadius: 5, background: "var(--accent)", color: "var(--on-accent)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              추가
            </button>
          </form>
        </div>
      )}

      {!collapsed &&
        children.map((c) => (
          <TodoRow
            key={c.id}
            todo={c}
            depth={depth + 1}
            byParent={byParent}
            canWrite={canWrite}
            editingId={editingId}
            setEditingId={setEditingId}
            addingParentId={addingParentId}
            setAddingParentId={setAddingParentId}
            dragged={dragged}
            setDragged={setDragged}
            dropTarget={dropTarget}
            setDropTarget={setDropTarget}
            onDrop={onDrop}
          />
        ))}
    </div>
  );
}

interface KanbanDragState {
  id: string;
  status: string;
}
interface KanbanDropTarget {
  id: string;
  status: string;
  pos: "before" | "after";
}

function KanbanCard({
  todo,
  canWrite,
  dragged,
  setDragged,
  dropTarget,
  setDropTarget,
  editingId,
  setEditingId,
  onDropOnCard,
}: {
  todo: TodoItem;
  canWrite: boolean;
  dragged: KanbanDragState | null;
  setDragged: (d: KanbanDragState | null) => void;
  dropTarget: KanbanDropTarget | null;
  setDropTarget: (d: KanbanDropTarget | null) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  onDropOnCard: (targetId: string, status: string, pos: "before" | "after") => void;
}) {
  const [, startTransition] = useTransition();
  const [dragArmed, setDragArmed] = useState(false);
  const [tagBg, tagFg] = CHIP[todo.tag] || CHIP.개인;
  const canAcceptDrop = canWrite && dragged && dragged.id !== todo.id;
  const isTop = canAcceptDrop && dropTarget?.id === todo.id && dropTarget.pos === "before";
  const isBottom = canAcceptDrop && dropTarget?.id === todo.id && dropTarget.pos === "after";

  if (editingId === todo.id) {
    return <EditTodoForm todo={todo} onDone={() => setEditingId(null)} />;
  }

  return (
    <div
      draggable={canWrite && dragArmed}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        setDragged({ id: todo.id, status: todo.status });
      }}
      onDragEnd={() => {
        setDragArmed(false);
        setDragged(null);
        setDropTarget(null);
      }}
      onDragOver={(e) => {
        if (!canAcceptDrop) return;
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        const pos = e.clientY - rect.top < rect.height / 2 ? "before" : "after";
        if (dropTarget?.id !== todo.id || dropTarget.pos !== pos) setDropTarget({ id: todo.id, status: todo.status, pos });
      }}
      onDrop={(e) => {
        if (!canAcceptDrop || !dropTarget) return;
        e.preventDefault();
        e.stopPropagation();
        onDropOnCard(todo.id, todo.status, dropTarget.pos);
      }}
      style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: 8,
        padding: "9px 10px",
        marginBottom: 6,
        opacity: dragged?.id === todo.id ? 0.4 : 1,
        boxShadow: isTop ? "0 -3px 0 var(--accent)" : isBottom ? "0 3px 0 var(--accent)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        {canWrite && (
          <span
            onMouseDown={() => setDragArmed(true)}
            onMouseUp={() => setDragArmed(false)}
            style={{ flex: "none", color: "var(--ink3)", fontSize: 11, marginTop: 1, cursor: "grab", userSelect: "none" }}
            title="드래그해서 이동"
          >
            ⠿
          </span>
        )}
        <div style={{ fontSize: 12.5, flex: 1, minWidth: 0, color: todo.status === "done" ? "var(--ink3)" : "var(--ink)", textDecoration: todo.status === "done" ? "line-through" : "none" }}>
          {todo.title}
        </div>
        {canWrite && (
          <div style={{ display: "flex", gap: 3, flex: "none" }}>
            <button onClick={() => setEditingId(todo.id)} title="편집" style={{ width: 19, height: 19, border: 0, background: "transparent", color: "var(--ink3)", cursor: "pointer", fontSize: 10.5 }}>
              ✎
            </button>
            <button
              onClick={() => confirm(`"${todo.title}"을(를) 삭제할까요?`) && startTransition(() => deleteTodoAction(todo.id))}
              title="삭제"
              style={{ width: 19, height: 19, border: 0, background: "transparent", color: "var(--ink3)", cursor: "pointer", fontSize: 10.5 }}
            >
              ✕
            </button>
          </div>
        )}
      </div>
      {todo.descriptionHtml && (
        <div
          className="wiki-content rich-text-content"
          onClick={(e) => handleDescriptionClick(e, todo.id, canWrite, startTransition)}
          style={{
            fontSize: 11,
            color: "var(--ink3)",
            marginTop: 4,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
          dangerouslySetInnerHTML={{ __html: todo.descriptionHtml }}
        />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontWeight: 500, padding: "1px 7px", borderRadius: 999, background: tagBg, color: tagFg }}>{todo.tag}</span>
        {todo.dueAt && (
          <span style={{ fontSize: 10.5, color: "var(--ink3)", fontFamily: "var(--font-mono), monospace" }}>
            {new Date(todo.dueAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}
          </span>
        )}
        {todo.repeat && <span style={{ fontSize: 10.5, color: "var(--ink3)", fontFamily: "var(--font-mono), monospace" }}>↻{todo.repeat}</span>}
      </div>
    </div>
  );
}

function KanbanColumn({
  status,
  label,
  cards,
  canWrite,
  dragged,
  setDragged,
  dropTarget,
  setDropTarget,
  editingId,
  setEditingId,
  onDropOnCard,
  onDropOnColumn,
}: {
  status: string;
  label: string;
  cards: TodoItem[];
  canWrite: boolean;
  dragged: KanbanDragState | null;
  setDragged: (d: KanbanDragState | null) => void;
  dropTarget: KanbanDropTarget | null;
  setDropTarget: (d: KanbanDropTarget | null) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  onDropOnCard: (targetId: string, status: string, pos: "before" | "after") => void;
  onDropOnColumn: (status: string) => void;
}) {
  const canAcceptDrop = canWrite && !!dragged;
  return (
    <div
      onDragOver={(e) => {
        if (!canAcceptDrop) return;
        e.preventDefault();
      }}
      onDrop={(e) => {
        if (!canAcceptDrop) return;
        e.preventDefault();
        onDropOnColumn(status);
      }}
      style={{ background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: 10, padding: 10, minHeight: 160, display: "flex", flexDirection: "column" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, padding: "0 2px" }}>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{label}</span>
        <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, color: "var(--ink3)" }}>{cards.length}</span>
      </div>
      <div style={{ flex: 1 }}>
        {cards.map((c) => (
          <KanbanCard
            key={c.id}
            todo={c}
            canWrite={canWrite}
            dragged={dragged}
            setDragged={setDragged}
            dropTarget={dropTarget}
            setDropTarget={setDropTarget}
            editingId={editingId}
            setEditingId={setEditingId}
            onDropOnCard={onDropOnCard}
          />
        ))}
        {cards.length === 0 && <div style={{ fontSize: 11.5, color: "var(--ink3)", textAlign: "center", padding: "18px 0" }}>없음</div>}
      </div>
    </div>
  );
}

interface GoogleCalendarEvent {
  id: string;
  title: string;
  start: string;
  allDay: boolean;
  htmlLink: string;
}

export function TodosClient({ todos, canWrite, googleEvents = [] }: { todos: TodoItem[]; canWrite: boolean; googleEvents?: GoogleCalendarEvent[] }) {
  const [view, setViewState] = useState<TodoView>("list");
  const setView = (v: TodoView) => {
    setViewState(v);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, v);
    } catch {}
  };
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (isTodoView(stored)) setViewState(stored);
    } catch {}
  }, []);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<Filter>("전체");
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingParentId, setAddingParentId] = useState<string | null>(null);
  const [dragged, setDragged] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; pos: "before" | "after" } | null>(null);
  const [kanbanDragged, setKanbanDragged] = useState<KanbanDragState | null>(null);
  const [kanbanDropTarget, setKanbanDropTarget] = useState<KanbanDropTarget | null>(null);
  const [, startTransition] = useTransition();
  const [listBg, listFg] = seg(view === "list");
  const [calBg, calFg] = seg(view === "cal");
  const [kanbanBg, kanbanFg] = seg(view === "kanban");

  const byParent = useMemo(() => {
    const m = new Map<string, TodoItem[]>();
    for (const t of todos) {
      const key = t.parentId || "__root__";
      m.set(key, [...(m.get(key) || []), t]);
    }
    return m;
  }, [todos]);

  const handleDrop = (targetId: string, pos: "before" | "after") => {
    if (!dragged) return;
    const groupKey = dragged.parentId || "__root__";
    const list = byParent.get(groupKey) || [];
    const idx = list.findIndex((t) => t.id === targetId);
    if (idx === -1) return;
    let beforeOrder: number | null;
    let afterOrder: number | null;
    if (pos === "before") {
      afterOrder = list[idx].order;
      const prev = list[idx - 1];
      beforeOrder = prev && prev.id !== dragged.id ? prev.order : idx > 0 ? list[idx - 2]?.order ?? null : null;
    } else {
      beforeOrder = list[idx].order;
      const next = list[idx + 1];
      afterOrder = next && next.id !== dragged.id ? next.order : null;
    }
    startTransition(() => reorderTodoAction(dragged.id, beforeOrder, afterOrder));
    setDragged(null);
    setDropTarget(null);
  };

  const projects = useMemo(() => Array.from(new Set(todos.map((t) => t.project).filter((p): p is string => !!p))).sort(), [todos]);

  const matchesFilters = (t: TodoItem): boolean => {
    if (projectFilter && t.project !== projectFilter) return false;
    if (tagFilter && t.tag !== tagFilter) return false;
    if (filter === "전체") return true;
    if (filter === "반복만") return !!t.repeat;
    if (!t.dueAt) return false;
    const d = new Date(t.dueAt);
    const now = new Date();
    if (filter === "오늘") return isSameDay(d, now);
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + (7 - now.getDay()));
    return d >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) && d <= weekEnd;
  };

  const kanbanColumns = useMemo(() => {
    const roots = (byParent.get("__root__") || []).filter(matchesFilters);
    const cols: Record<string, TodoItem[]> = { todo: [], in_progress: [], done: [] };
    for (const t of roots) (cols[t.status] || cols.todo).push(t);
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byParent, filter, projectFilter, tagFilter]);

  const moveKanbanCard = (status: string, targetId: string | null, pos: "before" | "after") => {
    if (!kanbanDragged) return;
    const list = kanbanColumns[status] || [];
    let beforeOrder: number | null = null;
    let afterOrder: number | null = null;
    if (targetId === null) {
      const last = list[list.length - 1];
      beforeOrder = last && last.id !== kanbanDragged.id ? last.order : null;
      afterOrder = null;
    } else {
      const idx = list.findIndex((t) => t.id === targetId);
      if (idx === -1) return;
      if (pos === "before") {
        afterOrder = list[idx].order;
        const prev = list[idx - 1];
        beforeOrder = prev && prev.id !== kanbanDragged.id ? prev.order : null;
      } else {
        beforeOrder = list[idx].order;
        const next = list[idx + 1];
        afterOrder = next && next.id !== kanbanDragged.id ? next.order : null;
      }
    }
    startTransition(() => moveTodoAction(kanbanDragged.id, status, beforeOrder, afterOrder));
    setKanbanDragged(null);
    setKanbanDropTarget(null);
  };

  const filteredRoots = useMemo(() => {
    return (byParent.get("__root__") || []).filter(matchesFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byParent, filter, projectFilter, tagFilter]);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const eventsByDay = new Map<number, TodoItem[]>();
  for (const t of todos) {
    if (!t.dueAt) continue;
    const d = new Date(t.dueAt);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const list = eventsByDay.get(d.getDate()) || [];
      list.push(t);
      eventsByDay.set(d.getDate(), list);
    }
  }
  const googleByDay = new Map<number, GoogleCalendarEvent[]>();
  for (const e of googleEvents) {
    const d = new Date(e.start);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const list = googleByDay.get(d.getDate()) || [];
      list.push(e);
      googleByDay.set(d.getDate(), list);
    }
  }
  const calDays = [];
  for (let i = -firstWeekday; i < daysInMonth + (7 - ((firstWeekday + daysInMonth) % 7 || 7)); i++) {
    const day = i + 1;
    const inMonth = day >= 1 && day <= daysInMonth;
    const today = inMonth && day === now.getDate();
    const evs = inMonth ? eventsByDay.get(day) || [] : [];
    const gevs = inMonth ? googleByDay.get(day) || [] : [];
    calDays.push({ day, inMonth, today, evs, gevs });
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", padding: 2, gap: 2, border: "1px solid var(--line)", borderRadius: 8, background: "var(--panel2)" }}>
          <button onClick={() => setView("list")} style={{ padding: "5px 13px", border: 0, borderRadius: 6, fontSize: 12.5, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", background: listBg, color: listFg }}>
            리스트
          </button>
          <button onClick={() => setView("kanban")} style={{ padding: "5px 13px", border: 0, borderRadius: 6, fontSize: 12.5, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", background: kanbanBg, color: kanbanFg }}>
            칸반
          </button>
          <button onClick={() => setView("cal")} style={{ padding: "5px 13px", border: 0, borderRadius: 6, fontSize: 12.5, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", background: calBg, color: calFg }}>
            캘린더
          </button>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTERS.map((f) => {
            const on = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{ padding: "5px 11px", border: `1px solid ${on ? "var(--accent)" : "var(--line)"}`, borderRadius: 999, background: on ? "var(--accent-soft)" : "var(--panel)", color: on ? "var(--accent)" : "var(--ink2)", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {f}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.keys(CHIP).map((t) => {
            const on = tagFilter === t;
            return (
              <button
                key={t}
                onClick={() => setTagFilter(on ? null : t)}
                style={{ padding: "5px 11px", border: `1px solid ${on ? "var(--accent)" : "var(--line)"}`, borderRadius: 999, background: on ? "var(--accent-soft)" : "var(--panel)", color: on ? "var(--accent)" : "var(--ink2)", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {t}
              </button>
            );
          })}
        </div>
        {projects.length > 0 && (
          <select
            value={projectFilter ?? ""}
            onChange={(e) => setProjectFilter(e.target.value || null)}
            style={{ height: 28, border: "1px solid var(--line)", borderRadius: 999, background: "var(--panel)", color: "var(--ink2)", fontSize: 12, padding: "0 10px" }}
          >
            <option value="">전체 프로젝트</option>
            {projects.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
        {canWrite && (
          <button
            onClick={() => setShowForm((v) => !v)}
            style={{ marginLeft: "auto", height: 30, padding: "0 13px", border: 0, borderRadius: 7, background: "var(--accent)", color: "var(--on-accent)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            + 새 할일
          </button>
        )}
      </div>

      {showForm && canWrite && (
        <form
          action={(fd) => {
            startTransition(() => createTodoAction(fd));
            setShowForm(false);
          }}
          style={{ display: "flex", gap: 8, marginBottom: 12, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 12, flexWrap: "wrap" }}
        >
          <input name="title" placeholder="제목" required style={{ flex: 1, minWidth: 160, height: 32, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink)", fontSize: 12.5 }} />
          <input name="project" placeholder="프로젝트" style={{ width: 120, height: 32, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink)", fontSize: 12.5 }} />
          <input name="dueAt" type="date" style={{ height: 32, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink)", fontSize: 12.5 }} />
          <input name="repeat" placeholder="반복 (예: 매일)" style={{ width: 110, height: 32, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink)", fontSize: 12.5 }} />
          <select name="tag" style={{ height: 32, border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink)", fontSize: 12.5 }}>
            <option value="업무">업무</option>
            <option value="반복">반복</option>
            <option value="개인">개인</option>
            <option value="마감">마감</option>
          </select>
          <select name="status" defaultValue="todo" style={{ height: 32, border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink)", fontSize: 12.5 }}>
            {STATUS_COLUMNS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <div style={{ flex: "1 1 100%" }}>
            <RichTextEditor name="description" />
          </div>
          <button type="submit" style={{ height: 32, padding: "0 14px", border: 0, borderRadius: 6, background: "var(--accent)", color: "var(--on-accent)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            추가
          </button>
        </form>
      )}

      {view === "list" && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
          {filteredRoots.length === 0 && <div style={{ padding: "24px 15px", fontSize: 12.5, color: "var(--ink3)" }}>표시할 할일이 없습니다.</div>}
          {filteredRoots.map((t) => (
            <TodoRow
              key={t.id}
              todo={t}
              depth={0}
              byParent={byParent}
              canWrite={canWrite}
              editingId={editingId}
              setEditingId={setEditingId}
              addingParentId={addingParentId}
              setAddingParentId={setAddingParentId}
              dragged={dragged}
              setDragged={setDragged}
              dropTarget={dropTarget}
              setDropTarget={setDropTarget}
              onDrop={handleDrop}
            />
          ))}
        </div>
      )}

      {view === "kanban" && (
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(220px,1fr))", gap: 12, minWidth: 700 }}>
            {STATUS_COLUMNS.map((s) => (
              <KanbanColumn
                key={s.key}
                status={s.key}
                label={s.label}
                cards={kanbanColumns[s.key] || []}
                canWrite={canWrite}
                dragged={kanbanDragged}
                setDragged={setKanbanDragged}
                dropTarget={kanbanDropTarget}
                setDropTarget={setKanbanDropTarget}
                editingId={editingId}
                setEditingId={setEditingId}
                onDropOnCard={(targetId, status, pos) => moveKanbanCard(status, targetId, pos)}
                onDropOnColumn={(status) => moveKanbanCard(status, null, "after")}
              />
            ))}
          </div>
        </div>
      )}

      {view === "cal" && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 15px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>
              {year}년 {month + 1}월
            </div>
            <div style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--ink3)" }}>마감일(dueAt)이 설정된 할일만 표시됩니다</div>
          </div>
          <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 560 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", background: "var(--panel2)", borderBottom: "1px solid var(--line2)" }}>
            {["월", "화", "수", "목", "금", "토", "일"].map((w) => (
              <div key={w} style={{ padding: "7px 10px", fontSize: 11, fontWeight: 600, color: "var(--ink3)" }}>
                {w}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))" }}>
            {calDays.map((d, i) => (
              <div
                key={i}
                style={{ minHeight: 80, padding: "6px 8px", borderRight: "1px solid var(--line2)", borderBottom: "1px solid var(--line2)", background: d.today ? "var(--accent-soft)" : d.inMonth ? "var(--panel)" : "var(--panel2)" }}
              >
                <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11.5, fontWeight: d.today ? 700 : 400, color: d.today ? "var(--accent)" : d.inMonth ? "var(--ink2)" : "var(--ink3)", marginBottom: 5 }}>
                  {d.inMonth ? d.day : ""}
                </div>
                {d.evs.map((e) => {
                  const [bg, fg] = CHIP[e.tag] || CHIP.개인;
                  return (
                    <div key={e.id} style={{ padding: "2px 5px", marginBottom: 3, borderRadius: 4, background: bg, color: fg, fontSize: 10.5, overflow: "hidden", whiteSpace: "nowrap" }}>
                      {e.title}
                    </div>
                  );
                })}
                {d.gevs.map((e) => (
                  <a
                    key={e.id}
                    href={e.htmlLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Google Calendar"
                    style={{
                      display: "block",
                      padding: "2px 5px",
                      marginBottom: 3,
                      borderRadius: 4,
                      background: "var(--panel3)",
                      color: "var(--ink2)",
                      fontSize: 10.5,
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      textDecoration: "none",
                    }}
                  >
                    📅 {e.title}
                  </a>
                ))}
              </div>
            ))}
          </div>
          </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useTransition } from "react";
import { updateTodoStatusAction } from "@/app/actions/todos";

const NEXT_STATUS: Record<string, string> = { todo: "in_progress", in_progress: "done", done: "todo" };
const LABEL: Record<string, string> = { todo: "할일", in_progress: "진행중", done: "완료" };
const COLOR: Record<string, [string, string]> = {
  todo: ["var(--panel3)", "var(--ink2)"],
  in_progress: ["var(--warn-soft)", "var(--warn)"],
  done: ["var(--ok-soft)", "var(--ok)"],
};

/** Replaces the old binary checkbox for a todo's status: clicking cycles 할일 → 진행중 → 완료 →
 * 할일, matching the same three states already used everywhere else (STATUS_COLUMNS, Kanban
 * columns, the edit form's status dropdown) instead of only being able to reach "완료" through a
 * checkbox that skips "진행중" entirely. */
export function TodoStatusToggle({ id, status, canWrite, compact }: { id: string; status: string; canWrite: boolean; compact?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [bg, fg] = COLOR[status] || COLOR.todo;
  const label = LABEL[status] || status;

  return (
    <button
      type="button"
      disabled={!canWrite || pending}
      onClick={(e) => {
        e.stopPropagation();
        const next = NEXT_STATUS[status] || "todo";
        startTransition(() => updateTodoStatusAction(id, next));
      }}
      title={canWrite ? "클릭하여 상태 변경 (할일 → 진행중 → 완료)" : undefined}
      style={{
        flex: "none",
        height: compact ? 18 : 20,
        padding: compact ? "0 6px" : "0 8px",
        border: 0,
        borderRadius: 999,
        background: bg,
        color: fg,
        fontSize: compact ? 9.5 : 10.5,
        fontWeight: 600,
        cursor: canWrite ? "pointer" : "default",
        opacity: pending ? 0.6 : 1,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

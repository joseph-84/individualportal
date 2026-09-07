"use client";

import { useTransition } from "react";
import { toggleTodoAction } from "@/app/actions/todos";

export function TodoCheckbox({ id, done, canWrite }: { id: string; done: boolean; canWrite: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={!canWrite || pending}
      onClick={() => startTransition(() => toggleTodoAction(id))}
      style={{
        width: 15,
        height: 15,
        flex: "none",
        padding: 0,
        borderRadius: 4,
        border: `1.5px solid ${done ? "var(--accent)" : "var(--line)"}`,
        background: done ? "var(--accent)" : "transparent",
        color: "var(--on-accent)",
        fontSize: 9,
        cursor: canWrite ? "pointer" : "not-allowed",
        display: "grid",
        placeItems: "center",
        opacity: pending ? 0.5 : 1,
      }}
    >
      {done ? "✓" : ""}
    </button>
  );
}

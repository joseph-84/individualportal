"use client";

import { useTransition } from "react";
import { runScriptAction } from "@/app/actions/scripts";

export function ScriptRunButton({ scriptId, canRun, disabledLabel = "권한 없음" }: { scriptId: string; canRun: boolean; disabledLabel?: string }) {
  const [pending, startTransition] = useTransition();
  const active = canRun && !pending;

  return (
    <button
      onClick={() => active && startTransition(() => runScriptAction(scriptId))}
      style={{
        height: 27,
        padding: "0 12px",
        border: 0,
        borderRadius: 7,
        background: active ? "var(--accent)" : "var(--panel3)",
        color: active ? "var(--on-accent)" : "var(--ink3)",
        fontSize: 12,
        fontWeight: 600,
        cursor: active ? "pointer" : "not-allowed",
      }}
    >
      {pending ? "실행중" : canRun ? "실행" : disabledLabel}
    </button>
  );
}

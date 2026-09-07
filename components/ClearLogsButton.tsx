"use client";

import { useTransition } from "react";
import { clearRunsAction } from "@/app/actions/scripts";

export function ClearLogsButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() => startTransition(() => clearRunsAction())}
      disabled={pending}
      style={{ marginLeft: "auto", height: 26, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink2)", fontSize: 11.5, cursor: pending ? "default" : "pointer" }}
    >
      지우기
    </button>
  );
}

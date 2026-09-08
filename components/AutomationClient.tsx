"use client";

import { useEffect, useState, useTransition, useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  registerScriptAction,
  updateScriptScheduleAction,
  toggleScriptEnabledAction,
  deleteScriptAction,
  type ScriptFormState,
} from "@/app/actions/scripts";
import { cronToLabel } from "@/lib/cron";
import { ScriptRunButton } from "./ScriptRunButton";

interface ScriptItem {
  id: string;
  file: string;
  lang: string;
  description: string;
  cron: string | null;
  enabled: boolean;
  status: string;
}

const ST_MAP: Record<string, [string, string, string]> = {
  ok: ["성공", "var(--ok-soft)", "var(--ok)"],
  running: ["실행중", "var(--accent-soft)", "var(--accent)"],
  err: ["실패", "var(--err-soft)", "var(--err)"],
  idle: ["대기", "var(--panel3)", "var(--ink2)"],
  off: ["비활성", "var(--panel3)", "var(--ink3)"],
};

const initialRegister: ScriptFormState = {};

function RegisterScriptForm({ onDone }: { onDone: () => void }) {
  const [state, formAction, pending] = useActionState(async (_prev: ScriptFormState, fd: FormData) => {
    const res = await registerScriptAction(_prev, fd);
    if (!res.error) onDone();
    return res;
  }, initialRegister);

  return (
    <form action={formAction} style={{ display: "grid", gap: 8, marginBottom: 12, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input name="file" placeholder="파일명 (예: backup.sh)" required style={{ width: 200, height: 30, padding: "0 9px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink)", fontSize: 12.5 }} />
        <select name="lang" style={{ height: 30, border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink)", fontSize: 12.5 }}>
          <option value="PY">Python</option>
          <option value="SH">Shell</option>
        </select>
        <input name="description" placeholder="설명" required style={{ flex: 1, minWidth: 160, height: 30, padding: "0 9px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink)", fontSize: 12.5 }} />
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          name="cron"
          placeholder="cron 표현식 (분 시 일 월 요일), 비우면 수동 실행만 — 예: 0 9 * * *"
          style={{ flex: 1, minWidth: 240, height: 30, padding: "0 9px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink)", fontSize: 12.5, fontFamily: "var(--font-mono), monospace" }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--ink2)" }}>
          <input type="checkbox" name="createFile" value="1" defaultChecked />
          서버에 새 파일 생성
        </label>
        <button type="submit" disabled={pending} style={{ height: 30, padding: "0 14px", border: 0, borderRadius: 6, background: "var(--accent)", color: "var(--on-accent)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
          {pending ? "등록 중..." : "등록"}
        </button>
        <button type="button" onClick={onDone} style={{ height: 30, padding: "0 12px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel)", color: "var(--ink2)", fontSize: 12.5, cursor: "pointer" }}>
          취소
        </button>
      </div>
      {state.error && <div style={{ fontSize: 12, color: "var(--err)" }}>{state.error}</div>}
      <div style={{ fontSize: 11, color: "var(--ink3)" }}>
        체크 해제 시 {`SCRIPTS_PATH`} 폴더에 파일이 이미 있어야 등록됩니다.
      </div>
    </form>
  );
}

function ScheduleEditor({ script, onDone }: { script: ScriptItem; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(async (_prev: ScriptFormState, fd: FormData) => {
    const res = await updateScriptScheduleAction(_prev, fd);
    if (!res.error) onDone();
    return res;
  }, initialRegister);

  return (
    <form action={formAction} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <input type="hidden" name="id" value={script.id} />
      <input
        name="cron"
        defaultValue={script.cron || ""}
        placeholder="0 9 * * *"
        style={{ width: 130, height: 26, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink)", fontSize: 11.5, fontFamily: "var(--font-mono), monospace" }}
      />
      <input type="hidden" name="description" value={script.description} />
      <button type="submit" disabled={pending} style={{ height: 26, padding: "0 8px", border: 0, borderRadius: 5, background: "var(--accent)", color: "var(--on-accent)", fontSize: 11, cursor: "pointer" }}>
        저장
      </button>
      <button type="button" onClick={onDone} style={{ height: 26, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink2)", fontSize: 11, cursor: "pointer" }}>
        취소
      </button>
      {state.error && <div style={{ fontSize: 11, color: "var(--err)", width: "100%" }}>{state.error}</div>}
    </form>
  );
}

function ScriptAdminActions({ script }: { script: ScriptItem }) {
  const [pending, startTransition] = useTransition();
  return (
    <div style={{ display: "flex", gap: 5 }}>
      <button
        disabled={pending}
        onClick={() => startTransition(() => toggleScriptEnabledAction(script.id))}
        style={{ height: 22, padding: "0 7px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel2)", color: "var(--ink2)", fontSize: 10.5, cursor: "pointer" }}
      >
        {script.enabled ? "비활성화" : "활성화"}
      </button>
      <button
        disabled={pending}
        onClick={() => {
          if (confirm(`"${script.file}" 등록을 해제하고 서버 파일도 삭제할까요?`)) startTransition(() => deleteScriptAction(script.id));
        }}
        style={{ height: 22, padding: "0 7px", border: "1px solid var(--err)", borderRadius: 5, background: "var(--err-soft)", color: "var(--err)", fontSize: 10.5, cursor: "pointer" }}
      >
        삭제
      </button>
    </div>
  );
}

export function AutomationClient({ scripts, canRun, canManage }: { scripts: ScriptItem[]; canRun: boolean; canManage: boolean }) {
  const router = useRouter();
  const [showRegister, setShowRegister] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null);

  // Lightweight live refresh: re-fetch the server component so run status/logs update
  // without a manual reload while this page is open (cron-triggered runs, in particular).
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 15_000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <section style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 15px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>등록된 스크립트</div>
        <span style={{ fontSize: 11, color: "var(--ink3)", border: "1px solid var(--line)", borderRadius: 5, padding: "1px 7px" }}>화이트리스트 {scripts.length}</span>
        {canManage && (
          <button
            onClick={() => setShowRegister((v) => !v)}
            style={{ marginLeft: "auto", height: 28, padding: "0 11px", border: 0, borderRadius: 7, background: "var(--accent)", color: "var(--on-accent)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            + 스크립트 등록
          </button>
        )}
      </div>
      {showRegister && canManage && <div style={{ padding: "12px 15px 0" }}><RegisterScriptForm onDone={() => setShowRegister(false)} /></div>}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: canManage ? "minmax(0,1fr) 130px 80px 76px 130px" : "minmax(0,1fr) 130px 80px 76px",
          gap: 10,
          padding: "8px 15px",
          background: "var(--panel2)",
          borderBottom: "1px solid var(--line)",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: ".04em",
          color: "var(--ink3)",
        }}
      >
        <div>스크립트</div>
        <div>스케줄</div>
        <div>상태</div>
        <div style={{ textAlign: "right" }}>실행</div>
        {canManage && <div style={{ textAlign: "right" }}>관리</div>}
      </div>
      {scripts.length === 0 && <div style={{ padding: 24, fontSize: 12.5, color: "var(--ink3)" }}>등록된 스크립트가 없습니다.</div>}
      {scripts.map((d) => {
        const status = !d.enabled ? "off" : d.status;
        const [label, bg, fg] = ST_MAP[status] || ST_MAP.idle;
        return (
          <div
            key={d.id}
            style={{ display: "grid", gridTemplateColumns: canManage ? "minmax(0,1fr) 130px 80px 76px 130px" : "minmax(0,1fr) 130px 80px 76px", gap: 10, alignItems: "center", padding: "9px 15px", borderBottom: "1px solid var(--line2)" }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.file}</span>
                <span style={{ fontSize: 9.5, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: d.lang === "PY" ? "var(--accent-soft)" : "var(--panel3)", color: d.lang === "PY" ? "var(--accent)" : "var(--ink2)", flex: "none" }}>
                  {d.lang}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--ink3)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.description}</div>
            </div>
            <div>
              {editingSchedule === d.id ? (
                <ScheduleEditor script={d} onDone={() => setEditingSchedule(null)} />
              ) : (
                <button
                  onClick={() => canManage && setEditingSchedule(d.id)}
                  title={d.cron || undefined}
                  style={{ border: 0, background: "transparent", padding: 0, fontFamily: "var(--font-mono), monospace", fontSize: 11.5, color: "var(--ink2)", cursor: canManage ? "pointer" : "default", textAlign: "left" }}
                >
                  {cronToLabel(d.cron)}
                </button>
              )}
            </div>
            <div>
              <span style={{ fontSize: 10.5, fontWeight: 500, padding: "2px 8px", borderRadius: 999, background: bg, color: fg }}>{label}</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <ScriptRunButton scriptId={d.id} canRun={canRun && d.enabled} disabledLabel={!d.enabled ? "비활성" : "권한 없음"} />
            </div>
            {canManage && (
              <div style={{ textAlign: "right" }}>
                <ScriptAdminActions script={d} />
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

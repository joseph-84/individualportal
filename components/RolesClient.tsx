"use client";

import { useMemo, useState, useTransition, useActionState } from "react";
import { PAGES } from "@/lib/constants";
import { savePermissionsAction, createRoleAction, type CreateRoleState, type PermChange } from "@/app/actions/roles";

interface RoleItem {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: Record<string, number>;
}

function cellStyle(v: number) {
  if (v === 2) return { label: "RW", bg: "var(--accent)", fg: "var(--on-accent)", bd: "var(--accent)" };
  if (v === 1) return { label: "R", bg: "var(--ok-soft)", fg: "var(--ok)", bd: "var(--ok)" };
  return { label: "—", bg: "var(--panel2)", fg: "var(--ink3)", bd: "var(--line)" };
}

const initialCreate: CreateRoleState = {};

function CreateRoleForm({ onDone }: { onDone: () => void }) {
  const [state, formAction, pending] = useActionState(async (_prev: CreateRoleState, fd: FormData) => {
    const res = await createRoleAction(_prev, fd);
    if (!res.error) onDone();
    return res;
  }, initialCreate);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10, padding: 10, border: "1px solid var(--line)", borderRadius: 8, background: "var(--panel2)" }}>
      <input name="key" placeholder="키 (예: viewer)" required style={{ height: 28, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel)", color: "var(--ink)", fontSize: 12 }} />
      <input name="name" placeholder="표시 이름" required style={{ height: 28, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel)", color: "var(--ink)", fontSize: 12 }} />
      <input name="description" placeholder="설명" style={{ height: 28, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel)", color: "var(--ink)", fontSize: 12 }} />
      <button type="submit" disabled={pending} style={{ height: 28, border: 0, borderRadius: 6, background: "var(--accent)", color: "var(--on-accent)", fontSize: 12, fontWeight: 600, cursor: pending ? "default" : "pointer" }}>
        {pending ? "생성 중..." : "역할 생성"}
      </button>
      {state.error && <div style={{ fontSize: 11.5, color: "var(--err)" }}>{state.error}</div>}
    </form>
  );
}

export function RolesClient({ roles, canWrite }: { roles: RoleItem[]; canWrite: boolean }) {
  const [matrix, setMatrix] = useState<Record<string, Record<string, number>>>(() =>
    Object.fromEntries(roles.map((r) => [r.key, { ...r.permissions }]))
  );
  const [showCreate, setShowCreate] = useState(false);
  const [pending, startTransition] = useTransition();
  const roleById = useMemo(() => Object.fromEntries(roles.map((r) => [r.key, r])), [roles]);

  const original = useMemo(() => Object.fromEntries(roles.map((r) => [r.key, { ...r.permissions }])), [roles]);

  let dirty = 0;
  for (const r of roles) {
    for (const p of PAGES) {
      if ((matrix[r.key]?.[p.key] ?? 0) !== (original[r.key]?.[p.key] ?? 0)) dirty++;
    }
  }

  const cycle = (roleKey: string, page: string) => {
    if (roleById[roleKey]?.isSystem) return;
    setMatrix((m) => {
      const roleMatrix = { ...(m[roleKey] || {}) };
      roleMatrix[page] = ((roleMatrix[page] ?? 0) + 1) % 3;
      return { ...m, [roleKey]: roleMatrix };
    });
  };

  const reset = () => setMatrix(original);

  const save = () => {
    const changes: PermChange[] = [];
    for (const r of roles) {
      for (const p of PAGES) {
        const next = matrix[r.key]?.[p.key] ?? 0;
        const prev = original[r.key]?.[p.key] ?? 0;
        if (next !== prev) changes.push({ roleId: r.id, page: p.key, level: next });
      }
    }
    if (changes.length === 0) return;
    startTransition(() => savePermissionsAction(changes));
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "224px minmax(440px,1fr)", gap: 12, alignItems: "start", overflowX: "auto" }}>
      <aside style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 10 }}>
        <div style={{ display: "flex", alignItems: "center", padding: "2px 8px 9px" }}>
          <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, fontWeight: 600, letterSpacing: ".1em", color: "var(--ink3)" }}>ROLES</div>
          {canWrite && (
            <button
              onClick={() => setShowCreate((v) => !v)}
              style={{ marginLeft: "auto", height: 24, padding: "0 9px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink2)", fontSize: 11.5, cursor: "pointer" }}
            >
              + 역할
            </button>
          )}
        </div>
        {showCreate && canWrite && <CreateRoleForm onDone={() => setShowCreate(false)} />}
        {roles.map((r) => (
          <div key={r.id} style={{ padding: "9px 11px", marginBottom: 6, border: "1px solid var(--line)", borderRadius: 8, background: "var(--panel2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{r.name}</span>
              {r.isSystem && <span style={{ fontSize: 10, color: "var(--ink3)" }}>시스템</span>}
              <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono), monospace", fontSize: 11, color: "var(--ink3)" }}>{r.userCount}명</span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink3)", marginTop: 3 }}>{r.description || "—"}</div>
          </div>
        ))}
      </aside>

      <section style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 15px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>역할 × 페이지 권한</div>
          <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>셀 클릭 시 없음 → 읽기 → 읽기·쓰기 (시스템 역할은 고정)</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `minmax(0,1.4fr) repeat(${roles.length}, minmax(86px,1fr))`, borderBottom: "1px solid var(--line)", background: "var(--panel2)" }}>
          <div style={{ padding: "10px 15px", fontSize: 11, fontWeight: 600, letterSpacing: ".04em", color: "var(--ink3)" }}>페이지</div>
          {roles.map((r) => (
            <div key={r.id} style={{ padding: "10px 8px", fontSize: 12, fontWeight: 600, textAlign: "center" }}>
              {r.key}
            </div>
          ))}
        </div>
        {PAGES.map((p) => (
          <div key={p.key} style={{ display: "grid", gridTemplateColumns: `minmax(0,1.4fr) repeat(${roles.length}, minmax(86px,1fr))`, borderBottom: "1px solid var(--line2)", alignItems: "center" }}>
            <div style={{ padding: "8px 15px", minWidth: 0 }}>
              <div style={{ fontSize: 13 }}>{p.label}</div>
              <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, color: "var(--ink3)" }}>/{p.key}</div>
            </div>
            {roles.map((r) => {
              const v = matrix[r.key]?.[p.key] ?? 0;
              const st = cellStyle(v);
              const locked = r.isSystem || !canWrite;
              return (
                <div key={r.id} style={{ padding: "6px 8px" }}>
                  <button
                    onClick={() => canWrite && cycle(r.key, p.key)}
                    disabled={locked}
                    style={{
                      width: "100%",
                      height: 30,
                      border: `1px solid ${st.bd}`,
                      borderRadius: 7,
                      background: st.bg,
                      color: st.fg,
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: locked ? "not-allowed" : "pointer",
                      opacity: r.isSystem ? 0.85 : 1,
                    }}
                  >
                    {st.label}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
        {canWrite && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 15px", background: "var(--panel2)" }}>
            <div style={{ fontSize: 12, color: "var(--ink3)" }}>{dirty === 0 ? "변경 사항 없음" : `저장되지 않은 변경 ${dirty}건`}</div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 7 }}>
              <button
                onClick={reset}
                disabled={dirty === 0}
                style={{ height: 30, padding: "0 12px", border: "1px solid var(--line)", borderRadius: 7, background: "var(--panel)", color: "var(--ink2)", fontSize: 12.5, cursor: dirty === 0 ? "default" : "pointer" }}
              >
                되돌리기
              </button>
              <button
                onClick={save}
                disabled={dirty === 0 || pending}
                style={{ height: 30, padding: "0 14px", border: 0, borderRadius: 7, background: "var(--accent)", color: "var(--on-accent)", fontSize: 12.5, fontWeight: 600, cursor: dirty === 0 ? "default" : "pointer", whiteSpace: "nowrap", opacity: pending ? 0.6 : 1 }}
              >
                {pending ? "저장 중..." : "변경 저장"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

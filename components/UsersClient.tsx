"use client";

import { useState, useTransition, useActionState } from "react";
import { toggleUserActiveAction, createUserAction, editUserAction, resetUserPasswordAction, type CreateUserState, type EditUserState } from "@/app/actions/users";

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  lastLoginAt: string | null;
  isSelf: boolean;
}

const ROLE_CHIP: Record<string, [string, string]> = {
  admin: ["var(--accent-soft)", "var(--accent)"],
  staff: ["var(--panel3)", "var(--ink2)"],
  audit: ["var(--warn-soft)", "var(--warn)"],
  guest: ["var(--panel3)", "var(--ink3)"],
};

function UserToggle({ id, active, disabled }: { id: string; active: boolean; disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={disabled || pending}
      onClick={() => startTransition(() => toggleUserActiveAction(id))}
      style={{ width: 30, height: 17, borderRadius: 999, border: 0, padding: 2, cursor: disabled ? "not-allowed" : "pointer", background: active ? "var(--ok)" : "var(--line)", display: "flex", justifyContent: active ? "flex-end" : "flex-start", opacity: pending ? 0.6 : 1 }}
    >
      <span style={{ width: 13, height: 13, borderRadius: "50%", background: "var(--panel)", display: "block" }} />
    </button>
  );
}

const initialCreate: CreateUserState = {};

function CreateUserForm({ roles, onDone }: { roles: { key: string; name: string }[]; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(async (_prev: CreateUserState, fd: FormData) => {
    const res = await createUserAction(_prev, fd);
    if (!res.error) onDone();
    return res;
  }, initialCreate);

  return (
    <form action={formAction} style={{ display: "flex", gap: 8, marginBottom: 12, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 12, flexWrap: "wrap" }}>
      <input name="name" placeholder="이름" required style={{ width: 120, height: 32, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink)", fontSize: 12.5 }} />
      <input name="email" type="email" placeholder="이메일" required style={{ flex: 1, minWidth: 180, height: 32, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink)", fontSize: 12.5 }} />
      <select name="role" required style={{ height: 32, border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink)", fontSize: 12.5 }}>
        {roles.map((r) => (
          <option key={r.key} value={r.key}>
            {r.name}
          </option>
        ))}
      </select>
      <input name="password" type="password" placeholder="초기 비밀번호 (8자 이상)" required style={{ width: 180, height: 32, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink)", fontSize: 12.5 }} />
      <button type="submit" disabled={pending} style={{ height: 32, padding: "0 14px", border: 0, borderRadius: 6, background: "var(--accent)", color: "var(--on-accent)", fontSize: 12.5, fontWeight: 600, cursor: pending ? "default" : "pointer" }}>
        {pending ? "추가 중..." : "추가"}
      </button>
      {state.error && <div style={{ width: "100%", fontSize: 12, color: "var(--err)" }}>{state.error}</div>}
    </form>
  );
}

const initialEdit: EditUserState = {};

function EditUserRow({ user, roles, onDone }: { user: UserItem; roles: { key: string; name: string }[]; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(async (_prev: EditUserState, fd: FormData) => {
    const res = await editUserAction(_prev, fd);
    if (res.success) onDone();
    return res;
  }, initialEdit);

  return (
    <form
      action={formAction}
      style={{ display: "grid", gridTemplateColumns: "minmax(140px,1fr) minmax(180px,1.2fr) 96px 140px 220px", gap: 10, alignItems: "center", padding: "8px 15px", minWidth: 900, borderBottom: "1px solid var(--line2)", background: "var(--panel2)" }}
    >
      <input type="hidden" name="id" value={user.id} />
      <input name="name" defaultValue={user.name} style={{ height: 28, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink)", fontSize: 12.5 }} />
      <input name="email" type="email" defaultValue={user.email} style={{ height: 28, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink)", fontSize: 12.5 }} />
      <select name="role" defaultValue={user.role} style={{ height: 28, border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink)", fontSize: 12 }}>
        {roles.map((r) => (
          <option key={r.key} value={r.key}>
            {r.name}
          </option>
        ))}
      </select>
      <div style={{ fontSize: 11, color: "var(--err)" }}>{state.error}</div>
      <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
        <button type="submit" disabled={pending} style={{ height: 25, padding: "0 9px", border: 0, borderRadius: 5, background: "var(--accent)", color: "var(--on-accent)", fontSize: 11.5, cursor: "pointer" }}>
          저장
        </button>
        <button type="button" onClick={onDone} style={{ height: 25, padding: "0 9px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink2)", fontSize: 11.5, cursor: "pointer" }}>
          취소
        </button>
      </div>
    </form>
  );
}

function ResetPasswordButton({ id, onResult }: { id: string; onResult: (pw: string) => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await resetUserPasswordAction(id);
          if (res.tempPassword) onResult(res.tempPassword);
        })
      }
      style={{ height: 25, padding: "0 9px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink2)", fontSize: 11.5, cursor: pending ? "default" : "pointer" }}
    >
      {pending ? "처리중" : "비밀번호 초기화"}
    </button>
  );
}

export function UsersClient({ users, roles, canWrite }: { users: UserItem[]; roles: { key: string; name: string }[]; canWrite: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempPw, setTempPw] = useState<{ id: string; pw: string } | null>(null);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>사용자 {users.length}명 · 비활성 {users.filter((u) => !u.active).length}명</div>
        {canWrite && (
          <button
            onClick={() => setShowForm((v) => !v)}
            style={{ marginLeft: "auto", height: 30, padding: "0 13px", border: 0, borderRadius: 7, background: "var(--accent)", color: "var(--on-accent)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            + 사용자 추가
          </button>
        )}
      </div>

      {showForm && canWrite && <CreateUserForm roles={roles} onDone={() => setShowForm(false)} />}

      {tempPw && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "10px 14px", border: "1px solid var(--ok)", borderRadius: 8, background: "var(--ok-soft)", fontSize: 12.5 }}>
          <span>임시 비밀번호가 발급되었습니다. 사용자에게 직접 전달하세요:</span>
          <code style={{ fontFamily: "var(--font-mono), monospace", fontWeight: 700 }}>{tempPw.pw}</code>
          <button onClick={() => setTempPw(null)} style={{ marginLeft: "auto", border: 0, background: "transparent", cursor: "pointer", color: "var(--ink3)" }}>
            ✕
          </button>
        </div>
      )}

      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(140px,1fr) minmax(180px,1.2fr) 96px 140px 220px",
            gap: 10,
            padding: "9px 15px",
            minWidth: 900,
            background: "var(--panel2)",
            borderBottom: "1px solid var(--line)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: ".04em",
            color: "var(--ink3)",
          }}
        >
          <div>이름</div>
          <div>이메일</div>
          <div>역할</div>
          <div>마지막 로그인</div>
          <div>상태 / 관리</div>
        </div>
        {users.map((u) => {
          if (editingId === u.id) {
            return <EditUserRow key={u.id} user={u} roles={roles} onDone={() => setEditingId(null)} />;
          }
          const [rb, rf] = ROLE_CHIP[u.role] || ["var(--panel3)", "var(--ink2)"];
          return (
            <div key={u.id} style={{ display: "grid", gridTemplateColumns: "minmax(140px,1fr) minmax(180px,1.2fr) 96px 140px 220px", gap: 10, alignItems: "center", padding: "8px 15px", minWidth: 900, borderBottom: "1px solid var(--line2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                <span style={{ width: 24, height: 24, flex: "none", borderRadius: "50%", background: "var(--panel3)", color: "var(--ink2)", display: "grid", placeItems: "center", fontSize: 10.5, fontWeight: 600 }}>
                  {u.name.slice(0, 2)}
                </span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, color: u.active ? "var(--ink)" : "var(--ink3)" }}>
                  {u.name}
                  {u.isSelf && <span style={{ color: "var(--ink3)", fontSize: 11 }}> (나)</span>}
                </span>
              </div>
              <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11.5, color: "var(--ink2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
              <div>
                <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 5, background: rb, color: rf }}>{u.role}</span>
              </div>
              <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11.5, color: "var(--ink3)" }}>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("ko-KR") : "—"}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <UserToggle id={u.id} active={u.active} disabled={!canWrite || u.isSelf} />
                {canWrite && (
                  <>
                    <button onClick={() => setEditingId(u.id)} style={{ height: 25, padding: "0 9px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink2)", fontSize: 11.5, cursor: "pointer" }}>
                      편집
                    </button>
                    <ResetPasswordButton id={u.id} onResult={(pw) => setTempPw({ id: u.id, pw })} />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

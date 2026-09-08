"use client";

import { useActionState, useTransition } from "react";
import { changeOwnPasswordAction, logoutAllSessionsAction, type ChangePasswordState } from "@/app/actions/auth";

const initial: ChangePasswordState = {};

export function AccountClient({ name, email, roleName }: { name: string; email: string; roleName: string }) {
  const [state, formAction, pending] = useActionState(changeOwnPasswordAction, initial);
  const [loggingOutAll, startLogoutAll] = useTransition();

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 480 }}>
      <section style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "16px 18px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>내 계정</div>
        <div style={{ fontSize: 12.5, color: "var(--ink2)", marginBottom: 4 }}>{name}</div>
        <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 4 }}>{email}</div>
        <div style={{ fontSize: 12, color: "var(--ink3)" }}>역할: {roleName}</div>
      </section>

      <section style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "16px 18px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>비밀번호 변경</div>
        <form action={formAction} style={{ display: "grid", gap: 10 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--ink2)", marginBottom: 5 }}>현재 비밀번호</label>
            <input
              type="password"
              name="current"
              required
              style={{ width: "100%", height: 34, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 7, background: "var(--panel2)", color: "var(--ink)", fontSize: 13 }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--ink2)", marginBottom: 5 }}>새 비밀번호 (8자 이상)</label>
            <input
              type="password"
              name="next"
              required
              minLength={8}
              style={{ width: "100%", height: 34, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 7, background: "var(--panel2)", color: "var(--ink)", fontSize: 13 }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--ink2)", marginBottom: 5 }}>새 비밀번호 확인</label>
            <input
              type="password"
              name="confirm"
              required
              minLength={8}
              style={{ width: "100%", height: 34, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 7, background: "var(--panel2)", color: "var(--ink)", fontSize: 13 }}
            />
          </div>
          {state.error && <div style={{ fontSize: 12, color: "var(--err)" }}>{state.error}</div>}
          {state.success && <div style={{ fontSize: 12, color: "var(--ok)" }}>비밀번호가 변경되었습니다.</div>}
          <button
            type="submit"
            disabled={pending}
            style={{ height: 34, border: 0, borderRadius: 7, background: "var(--accent)", color: "var(--on-accent)", fontSize: 12.5, fontWeight: 600, cursor: pending ? "default" : "pointer" }}
          >
            {pending ? "변경 중..." : "비밀번호 변경"}
          </button>
        </form>
      </section>

      <section style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "16px 18px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>세션</div>
        <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 10 }}>다른 기기에 로그인된 세션을 포함해 모두 로그아웃합니다.</div>
        <button
          onClick={() => startLogoutAll(() => logoutAllSessionsAction())}
          disabled={loggingOutAll}
          style={{ height: 32, padding: "0 14px", border: "1px solid var(--line)", borderRadius: 7, background: "var(--panel2)", color: "var(--ink2)", fontSize: 12.5, cursor: loggingOutAll ? "default" : "pointer" }}
        >
          {loggingOutAll ? "처리 중..." : "모든 기기에서 로그아웃"}
        </button>
      </section>
    </div>
  );
}

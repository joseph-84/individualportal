"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/actions/auth";
import { useTheme } from "@/lib/theme-context";

const LOGIN_STATS = [
  { k: "등록 스크립트", v: "4" },
  { k: "서비스 상태", v: "operational" },
];

const initialState: LoginState = {};

export function LoginScreen() {
  const { theme } = useTheme();
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div data-theme={theme} style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--ink)", fontSize: 13.5 }}>
      <div className="login-grid" style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 40px" }}>
          <form action={formAction} style={{ width: "100%", maxWidth: 336 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 36 }}>
              <div
                style={{
                  width: 25,
                  height: 25,
                  borderRadius: 7,
                  background: "var(--accent)",
                  color: "var(--on-accent)",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 700,
                  fontSize: 12.5,
                }}
              >
                P
              </div>
              <div style={{ fontWeight: 600, letterSpacing: "-.01em" }}>Portal</div>
              <div
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 10.5,
                  color: "var(--ink3)",
                  borderLeft: "1px solid var(--line)",
                  paddingLeft: 9,
                }}
              >
                v1.0.0
              </div>
            </div>
            <h1 style={{ margin: "0 0 6px", fontSize: 23, fontWeight: 600, letterSpacing: "-.02em" }}>로그인</h1>
            <p style={{ margin: "0 0 26px", color: "var(--ink3)", fontSize: 13 }}>계정으로 접속하세요.</p>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--ink2)", marginBottom: 6 }}>이메일</label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              style={{
                width: "100%",
                height: 38,
                padding: "0 11px",
                marginBottom: 14,
                border: "1px solid var(--line)",
                borderRadius: 8,
                background: "var(--panel)",
                color: "var(--ink)",
                fontSize: 13.5,
                outline: "none",
              }}
            />
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--ink2)", marginBottom: 6 }}>비밀번호</label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              style={{
                width: "100%",
                height: 38,
                padding: "0 11px",
                marginBottom: 12,
                border: "1px solid var(--line)",
                borderRadius: 8,
                background: "var(--panel)",
                color: "var(--ink)",
                fontSize: 13.5,
                outline: "none",
              }}
            />
            {state.error && (
              <div style={{ marginBottom: 12, fontSize: 12.5, color: "var(--err)" }}>{state.error}</div>
            )}
            <button
              type="submit"
              disabled={pending}
              style={{
                width: "100%",
                height: 39,
                border: 0,
                borderRadius: 8,
                background: "var(--accent)",
                color: "var(--on-accent)",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: pending ? "default" : "pointer",
                opacity: pending ? 0.7 : 1,
              }}
            >
              {pending ? "로그인 중..." : "로그인"}
            </button>
          </form>
        </div>
        <div
          className="login-panel-right"
          style={{
            background: "var(--panel)",
            borderLeft: "1px solid var(--line)",
            padding: "48px 44px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 24,
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.5, maxWidth: "28ch", letterSpacing: "-.01em" }}>
            업무·지식·반복 작업을 한 화면에서. 노트, 파일, 자동화 스크립트를 권한 단위로 관리합니다.
          </div>
          <div
            style={{
              display: "grid",
              gap: 1,
              background: "var(--line2)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              overflow: "hidden",
              maxWidth: 360,
            }}
          >
            {LOGIN_STATS.map((s) => (
              <div
                key={s.k}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "11px 14px",
                  background: "var(--panel2)",
                }}
              >
                <span style={{ color: "var(--ink2)", fontSize: 12.5 }}>{s.k}</span>
                <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12.5, fontWeight: 500 }}>{s.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

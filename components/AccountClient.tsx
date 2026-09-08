"use client";

import { useEffect, useState, useTransition, useActionState } from "react";
import { changeOwnPasswordAction, logoutAllSessionsAction, type ChangePasswordState } from "@/app/actions/auth";
import { listApiTokensAction, createApiTokenAction, revokeApiTokenAction, type CreateTokenState } from "@/app/actions/tokens";

const initial: ChangePasswordState = {};

function PasswordSection() {
  const [state, formAction, pending] = useActionState(changeOwnPasswordAction, initial);
  return (
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
  );
}

function SessionSection() {
  const [loggingOutAll, startLogoutAll] = useTransition();
  return (
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
  );
}

interface ApiTokenItem {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const initialToken: CreateTokenState = {};

function ApiTokenSection({ mcpUrl }: { mcpUrl: string }) {
  const [tokens, setTokens] = useState<ApiTokenItem[] | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState(async (_prev: CreateTokenState, fd: FormData) => {
    const res = await createApiTokenAction(_prev, fd);
    if (res.token) {
      setNewToken(res.token);
      load();
    }
    return res;
  }, initialToken);

  const load = () => {
    startTransition(async () => {
      const res = await listApiTokensAction();
      setTokens(res.map((t) => ({ id: t.id, name: t.name, tokenPrefix: t.tokenPrefix, createdAt: t.createdAt.toString(), lastUsedAt: t.lastUsedAt ? t.lastUsedAt.toString() : null })));
    });
  };

  useEffect(load, []);

  const revoke = (id: string) => {
    startTransition(async () => {
      await revokeApiTokenAction(id);
      load();
    });
  };

  return (
    <section style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "16px 18px" }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>API 토큰 (MCP 연동)</div>
      <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 12 }}>
        외부 MCP 클라이언트가 이 계정 권한으로 포털에 접속하도록 허용합니다. MCP 엔드포인트: <code style={{ fontFamily: "var(--font-mono), monospace", background: "var(--panel3)", padding: "1px 5px", borderRadius: 4 }}>{mcpUrl}</code>, 헤더{" "}
        <code style={{ fontFamily: "var(--font-mono), monospace", background: "var(--panel3)", padding: "1px 5px", borderRadius: 4 }}>Authorization: Bearer &lt;토큰&gt;</code>
      </div>

      {newToken && (
        <div style={{ padding: "10px 12px", marginBottom: 12, border: "1px solid var(--ok)", borderRadius: 8, background: "var(--ok-soft)" }}>
          <div style={{ fontSize: 11.5, color: "var(--ink2)", marginBottom: 6 }}>토큰은 지금 한 번만 표시됩니다. 안전한 곳에 저장하세요.</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <code style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", fontFamily: "var(--font-mono), monospace", fontSize: 11.5, background: "var(--panel)", padding: "6px 8px", borderRadius: 6, wordBreak: "break-all" }}>
              {newToken}
            </code>
            <button
              onClick={() => navigator.clipboard?.writeText(newToken)}
              style={{ height: 28, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel)", color: "var(--ink2)", fontSize: 11.5, cursor: "pointer" }}
            >
              복사
            </button>
            <button onClick={() => setNewToken(null)} style={{ border: 0, background: "transparent", color: "var(--ink3)", cursor: "pointer" }}>
              ✕
            </button>
          </div>
        </div>
      )}

      <form action={formAction} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input name="name" placeholder="토큰 이름 (예: Claude Desktop)" required style={{ flex: 1, height: 32, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 7, background: "var(--panel2)", color: "var(--ink)", fontSize: 12.5 }} />
        <button type="submit" disabled={pending} style={{ height: 32, padding: "0 14px", border: 0, borderRadius: 7, background: "var(--accent)", color: "var(--on-accent)", fontSize: 12.5, fontWeight: 600, cursor: pending ? "default" : "pointer" }}>
          생성
        </button>
      </form>
      {state.error && <div style={{ fontSize: 12, color: "var(--err)", marginBottom: 10 }}>{state.error}</div>}

      <div style={{ display: "grid", gap: 6 }}>
        {tokens === null && <div style={{ fontSize: 12, color: "var(--ink3)" }}>불러오는 중...</div>}
        {tokens?.length === 0 && <div style={{ fontSize: 12, color: "var(--ink3)" }}>생성된 토큰이 없습니다.</div>}
        {tokens?.map((t) => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 7, background: "var(--panel2)" }}>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12.5 }}>{t.name}</span>
            <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, color: "var(--ink3)" }}>{t.tokenPrefix}…</span>
            <span style={{ fontSize: 11, color: "var(--ink3)" }}>{t.lastUsedAt ? `최근 사용 ${new Date(t.lastUsedAt).toLocaleDateString("ko-KR")}` : "미사용"}</span>
            <button onClick={() => revoke(t.id)} style={{ height: 24, padding: "0 8px", border: "1px solid var(--err)", borderRadius: 5, background: "var(--err-soft)", color: "var(--err)", fontSize: 11, cursor: "pointer" }}>
              취소
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AccountClient({ name, email, mcpUrl }: { name: string; email: string; mcpUrl: string }) {
  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 560 }}>
      <section style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "16px 18px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>내 계정</div>
        <div style={{ fontSize: 12.5, color: "var(--ink2)", marginBottom: 4 }}>{name}</div>
        <div style={{ fontSize: 12, color: "var(--ink3)" }}>{email}</div>
      </section>

      <PasswordSection />
      <SessionSection />
      <ApiTokenSection mcpUrl={mcpUrl} />
    </div>
  );
}

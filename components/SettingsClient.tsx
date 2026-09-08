"use client";

import { useState, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";

interface GoogleStatus {
  connected: boolean;
  accountEmail: string | null;
}

function GoogleCalendarCard({ initial }: { initial: GoogleStatus }) {
  const [status, setStatus] = useState(initial);
  const [pending, startTransition] = useTransition();

  const disconnect = () => {
    if (!confirm("Google Calendar 연동을 해제할까요? 가져온 일정이 더 이상 표시되지 않습니다.")) return;
    startTransition(async () => {
      await fetch("/api/integrations/google/disconnect", { method: "POST" });
      setStatus({ connected: false, accountEmail: null });
    });
  };

  return (
    <section style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center", fontSize: 15, flex: "none" }}>
          📅
        </div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Google Calendar</div>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 10.5,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 999,
            background: status.connected ? "var(--ok-soft)" : "var(--panel3)",
            color: status.connected ? "var(--ok)" : "var(--ink3)",
          }}
        >
          {status.connected ? "연동됨" : "미연동"}
        </span>
      </div>
      <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 12 }}>
        Google Calendar의 일정을 포털에 읽기 전용으로 불러와 할일 캘린더 뷰에 함께 표시합니다. 포털에서 이 일정을 수정·삭제할 수는 없습니다.
        {status.connected && status.accountEmail && (
          <div style={{ marginTop: 4, color: "var(--ink2)" }}>
            연결된 계정: <span style={{ fontFamily: "var(--font-mono), monospace" }}>{status.accountEmail}</span>
          </div>
        )}
      </div>
      {status.connected ? (
        <button
          onClick={disconnect}
          disabled={pending}
          style={{ height: 32, padding: "0 14px", border: "1px solid var(--err)", borderRadius: 7, background: "var(--err-soft)", color: "var(--err)", fontSize: 12.5, cursor: pending ? "default" : "pointer" }}
        >
          {pending ? "처리 중..." : "연동 해제"}
        </button>
      ) : (
        <a
          href="/api/integrations/google/start"
          style={{
            display: "inline-flex",
            height: 32,
            padding: "0 14px",
            alignItems: "center",
            border: 0,
            borderRadius: 7,
            background: "var(--accent)",
            color: "var(--on-accent)",
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
            textDecoration: "none",
          }}
        >
          Google 계정 연결
        </a>
      )}
    </section>
  );
}

export function SettingsClient({ google }: { google: GoogleStatus }) {
  const params = useSearchParams();
  const router = useRouter();
  const error = params.get("error");
  const connected = params.get("connected");

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 560 }}>
      {error && (
        <div style={{ padding: "10px 14px", border: "1px solid var(--err)", borderRadius: 8, background: "var(--err-soft)", color: "var(--err)", fontSize: 12.5, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => router.replace("/settings")} style={{ border: 0, background: "transparent", color: "var(--err)", cursor: "pointer" }}>
            ✕
          </button>
        </div>
      )}
      {connected && !error && (
        <div style={{ padding: "10px 14px", border: "1px solid var(--ok)", borderRadius: 8, background: "var(--ok-soft)", color: "var(--ok)", fontSize: 12.5, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ flex: 1 }}>연동이 완료되었습니다.</span>
          <button onClick={() => router.replace("/settings")} style={{ border: 0, background: "transparent", color: "var(--ok)", cursor: "pointer" }}>
            ✕
          </button>
        </div>
      )}

      <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, fontWeight: 600, letterSpacing: ".1em", color: "var(--ink3)", padding: "0 2px" }}>
        캘린더 연동
      </div>
      <GoogleCalendarCard initial={google} />

      <div style={{ fontSize: 11.5, color: "var(--ink3)", padding: "4px 2px" }}>
        다른 외부 서비스 연동은 추후 이 목록에 추가될 예정입니다.
      </div>
    </div>
  );
}

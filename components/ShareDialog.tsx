"use client";

import { useEffect, useState, useTransition } from "react";
import { listShareLinksAction, createShareLinkAction, revokeShareLinkAction } from "@/app/actions/share";

interface ShareLinkItem {
  id: string;
  token: string;
  scope: string;
  email: string | null;
  createdAt: string;
}

export function ShareDialog({ relPath, onClose }: { relPath: string; onClose: () => void }) {
  const [links, setLinks] = useState<ShareLinkItem[] | null>(null);
  const [scope, setScope] = useState<"email_otp" | "public">("email_otp");
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const load = () => {
    startTransition(async () => {
      const res = await listShareLinksAction(relPath);
      setLinks(res.map((l) => ({ id: l.id, token: l.token, scope: l.scope, email: l.email, createdAt: l.createdAt.toString() })));
    });
  };

  useEffect(load, []);

  const create = () => {
    setError(null);
    startTransition(async () => {
      const res = await createShareLinkAction(relPath, scope, scope === "email_otp" ? email : undefined);
      if (res.error) setError(res.error);
      else setEmail("");
      load();
    });
  };

  const revoke = (id: string) => {
    startTransition(async () => {
      await revokeShareLinkAction(id);
      load();
    });
  };

  const copy = (token: string) => {
    navigator.clipboard?.writeText(`${origin}/share/${token}`).catch(() => {});
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "grid", placeItems: "center", zIndex: 50 }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 440, maxWidth: "90vw", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 18, boxShadow: "0 16px 40px rgba(0,0,0,.25)" }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>파일 공유</div>
          <button onClick={onClose} style={{ marginLeft: "auto", border: 0, background: "transparent", color: "var(--ink3)", cursor: "pointer", fontSize: 14 }}>
            ✕
          </button>
        </div>
        <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11.5, color: "var(--ink3)", marginBottom: 14, wordBreak: "break-all" }}>{relPath}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
          <select value={scope} onChange={(e) => setScope(e.target.value as "email_otp" | "public")} style={{ height: 32, border: "1px solid var(--line)", borderRadius: 7, background: "var(--panel2)", color: "var(--ink)", fontSize: 12.5 }}>
            <option value="email_otp">특정 이메일 (열람 시마다 OTP 인증)</option>
            <option value="public">전체 공개 (링크만 있으면 누구나)</option>
          </select>
          {scope === "email_otp" && (
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="열람을 허용할 이메일 주소"
              style={{ height: 32, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 7, background: "var(--panel2)", color: "var(--ink)", fontSize: 12.5 }}
            />
          )}
          <button onClick={create} disabled={pending} style={{ height: 32, padding: "0 14px", border: 0, borderRadius: 7, background: "var(--accent)", color: "var(--on-accent)", fontSize: 12.5, fontWeight: 600, cursor: pending ? "default" : "pointer" }}>
            링크 생성
          </button>
        </div>
        {error && <div style={{ fontSize: 12, color: "var(--err)", marginBottom: 10 }}>{error}</div>}

        <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, fontWeight: 600, letterSpacing: ".1em", color: "var(--ink3)", marginBottom: 8 }}>
          활성 링크
        </div>
        <div style={{ display: "grid", gap: 6, maxHeight: 220, overflow: "auto" }}>
          {links === null && <div style={{ fontSize: 12, color: "var(--ink3)" }}>불러오는 중...</div>}
          {links?.length === 0 && <div style={{ fontSize: 12, color: "var(--ink3)" }}>생성된 공유 링크가 없습니다.</div>}
          {links?.map((l) => (
            <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 9px", border: "1px solid var(--line)", borderRadius: 7, background: "var(--panel2)", flexWrap: "wrap" }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: l.scope === "public" ? "var(--warn-soft)" : "var(--ok-soft)", color: l.scope === "public" ? "var(--warn)" : "var(--ok)", flex: "none" }}>
                {l.scope === "public" ? "전체공개" : "OTP"}
              </span>
              {l.email && <span style={{ fontSize: 11, color: "var(--ink3)", flex: "none" }}>{l.email}</span>}
              <span style={{ flex: 1, minWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11.5, fontFamily: "var(--font-mono), monospace", color: "var(--ink2)" }}>
                /share/{l.token}
              </span>
              <button onClick={() => copy(l.token)} style={{ height: 24, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink2)", fontSize: 11, cursor: "pointer" }}>
                복사
              </button>
              <button onClick={() => revoke(l.id)} style={{ height: 24, padding: "0 8px", border: "1px solid var(--err)", borderRadius: 5, background: "var(--err-soft)", color: "var(--err)", fontSize: 11, cursor: "pointer" }}>
                취소
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

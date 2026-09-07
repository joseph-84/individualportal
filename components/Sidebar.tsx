"use client";

import { useRouter, usePathname } from "next/navigation";
import { PAGES } from "@/lib/constants";
import { pageKeyToPath, pathToPageKey } from "@/lib/routing";
import { logoutAction } from "@/app/actions/auth";
import { Icon } from "./Icon";

interface Props {
  roleKey: string;
  roleName: string;
  userName: string;
  permissions: Record<string, number>;
}

export function Sidebar({ roleKey, roleName, userName, permissions }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const current = pathToPageKey(pathname);

  const mainItems = PAGES.filter((p) => !p.admin);
  const adminItems = PAGES.filter((p) => p.admin).filter((p) => (permissions[p.key] ?? 0) > 0);

  const renderItem = (p: (typeof PAGES)[number]) => {
    const lvl = permissions[p.key] ?? 0;
    if (lvl === 0) return null;
    const on = current === p.key;
    return (
      <button
        key={p.key}
        onClick={() => router.push(pageKeyToPath(p.key))}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: 8,
          border: 0,
          borderRadius: 7,
          background: on ? "var(--accent-soft)" : "transparent",
          color: on ? "var(--accent)" : "var(--ink2)",
          fontSize: 13,
          fontWeight: on ? 600 : 450,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ width: 16, height: 16, flex: "none", display: "grid", placeItems: "center", opacity: on ? 1 : 0.7 }}>
          <Icon name={p.icon} />
        </span>
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.label}</span>
        {lvl === 1 && (
          <span
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 9.5,
              color: "var(--ink3)",
              border: "1px solid var(--line)",
              borderRadius: 3,
              padding: "0 3px",
            }}
          >
            R
          </span>
        )}
      </button>
    );
  };

  return (
    <aside
      style={{
        background: "var(--panel)",
        borderRight: "1px solid var(--line)",
        display: "flex",
        flexDirection: "column",
        padding: "12px 10px",
        gap: 3,
        position: "sticky",
        top: 0,
        height: "100vh",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 8px 14px" }}>
        <div
          style={{
            width: 23,
            height: 23,
            borderRadius: 6,
            background: "var(--accent)",
            color: "var(--on-accent)",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          P
        </div>
        <div style={{ fontWeight: 600, fontSize: 13.5, letterSpacing: "-.01em" }}>Portal</div>
        <div
          style={{
            marginLeft: "auto",
            fontFamily: "var(--font-mono), monospace",
            fontSize: 10,
            color: "var(--ink3)",
            border: "1px solid var(--line)",
            borderRadius: 4,
            padding: "1px 5px",
          }}
        >
          {roleKey}
        </div>
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: ".12em",
          color: "var(--ink3)",
          padding: "8px 8px 5px",
        }}
      >
        WORKSPACE
      </div>
      {mainItems.map(renderItem)}
      {adminItems.length > 0 && (
        <div
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: ".12em",
            color: "var(--ink3)",
            padding: "16px 8px 5px",
          }}
        >
          ADMIN
        </div>
      )}
      {adminItems.map(renderItem)}
      <div
        style={{
          marginTop: "auto",
          padding: "12px 8px 2px",
          borderTop: "1px solid var(--line2)",
          display: "flex",
          alignItems: "center",
          gap: 9,
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: "var(--panel3)",
            color: "var(--ink2)",
            display: "grid",
            placeItems: "center",
            fontSize: 10.5,
            fontWeight: 600,
            flex: "none",
          }}
        >
          {userName.slice(0, 2)}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</div>
          <div style={{ fontSize: 11, color: "var(--ink3)" }}>{roleName}</div>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            title="로그아웃"
            style={{
              border: "1px solid var(--line)",
              background: "var(--panel2)",
              color: "var(--ink3)",
              borderRadius: 6,
              width: 24,
              height: 24,
              cursor: "pointer",
              fontSize: 11,
              display: "grid",
              placeItems: "center",
            }}
          >
            ⏻
          </button>
        </form>
      </div>
    </aside>
  );
}

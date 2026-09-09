"use client";

import { usePathname } from "next/navigation";
import { TITLES } from "@/lib/constants";
import { pathToPageKey } from "@/lib/routing";
import { useTheme } from "@/lib/theme-context";
import { useMobileNav } from "@/lib/mobile-nav-context";
import { HeaderSearch } from "./HeaderSearch";
import { NotificationBell } from "./NotificationBell";

export function Header() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { toggle } = useMobileNav();
  const pageKey = pathToPageKey(pathname);
  const [title, subtitle] = TITLES[pageKey] || ["", ""];

  return (
    <header
      className="app-header"
      style={{
        height: 52,
        flex: "none",
        borderBottom: "1px solid var(--line)",
        background: "var(--panel)",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 18px",
        position: "sticky",
        top: 0,
        zIndex: 5,
      }}
    >
      <button
        onClick={toggle}
        className="app-hamburger"
        aria-label="메뉴 열기"
        style={{ width: 30, height: 30, border: "1px solid var(--line)", borderRadius: 7, background: "var(--panel2)", color: "var(--ink2)", cursor: "pointer", fontSize: 14, flex: "none" }}
      >
        ☰
      </button>
      <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-.01em", whiteSpace: "nowrap" }}>{title}</div>
      <div
        className="app-header-subtitle"
        style={{
          fontSize: 12,
          color: "var(--ink3)",
          borderLeft: "1px solid var(--line)",
          paddingLeft: 14,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {subtitle}
      </div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
        <HeaderSearch />
        <button
          onClick={toggleTheme}
          title="테마"
          style={{
            width: 30,
            height: 30,
            border: "1px solid var(--line)",
            borderRadius: 7,
            background: "var(--panel2)",
            color: "var(--ink2)",
            cursor: "pointer",
            fontSize: 12.5,
          }}
        >
          {theme === "light" ? "☾" : "☀"}
        </button>
        <NotificationBell />
      </div>
    </header>
  );
}

"use client";

import { useTheme } from "@/lib/theme-context";

export function ThemedShell({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <div
      data-theme={theme}
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--ink)",
        fontSize: "13.5px",
        lineHeight: 1.5,
        display: "grid",
        gridTemplateColumns: "226px minmax(0,1fr)",
      }}
    >
      {children}
    </div>
  );
}

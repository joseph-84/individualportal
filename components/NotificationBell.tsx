"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getNotificationsAction, type NotificationItem } from "@/app/actions/notifications";

export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const res = await getNotificationsAction();
      if (!cancelled) setItems(res);
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "relative",
          width: 30,
          height: 30,
          border: "1px solid var(--line)",
          borderRadius: 7,
          background: "var(--panel2)",
          color: "var(--ink2)",
          cursor: "pointer",
          fontSize: 12,
        }}
      >
        <span>◔</span>
        {items.length > 0 && (
          <span
            style={{
              position: "absolute",
              top: -3,
              right: -3,
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--accent)",
              border: "2px solid var(--panel)",
            }}
          />
        )}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: 36,
            right: 0,
            width: 260,
            maxHeight: 320,
            overflow: "auto",
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,.15)",
            zIndex: 20,
          }}
        >
          {items.length === 0 && <div style={{ padding: 14, fontSize: 12, color: "var(--ink3)" }}>새 알림이 없습니다.</div>}
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                setOpen(false);
                router.push(n.href);
              }}
              style={{ display: "block", width: "100%", padding: "9px 12px", border: 0, borderBottom: "1px solid var(--line2)", background: "transparent", textAlign: "left", cursor: "pointer", fontSize: 12.5, color: "var(--ink2)" }}
            >
              {n.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

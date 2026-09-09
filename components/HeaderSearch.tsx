"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchAction, type SearchResult } from "@/app/actions/search";

const KIND_LABEL: Record<string, string> = { todo: "할일", note: "위키", file: "파일" };

export function HeaderSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const res = await searchAction(query);
        setResults(res);
      });
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        requestAnimationFrame(() => containerRef.current?.querySelector("input")?.focus());
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (r: SearchResult) => {
    setOpen(false);
    setQuery("");
    router.push(r.href);
  };

  return (
    <div ref={containerRef} style={{ position: "relative", flex: "none" }}>
      <div
        onClick={() => setOpen(true)}
        className="app-header-search-trigger"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          height: 30,
          padding: "0 10px",
          border: "1px solid var(--line)",
          borderRadius: 7,
          background: "var(--panel2)",
          color: "var(--ink3)",
          fontSize: 12.5,
          width: 196,
          cursor: "text",
        }}
      >
        <span>⌕</span>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="검색"
          style={{ border: 0, outline: "none", background: "transparent", color: "var(--ink)", fontSize: 12.5, flex: 1, minWidth: 0 }}
        />
        <span className="app-header-search-hint" style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10.5 }}>⌘K</span>
      </div>

      {open && query.trim().length >= 2 && (
        <div
          className="app-header-search-results"
          style={{
            position: "absolute",
            top: 36,
            right: 0,
            width: 320,
            maxHeight: 360,
            overflow: "auto",
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,.15)",
            zIndex: 20,
          }}
        >
          {pending && <div style={{ padding: 14, fontSize: 12, color: "var(--ink3)" }}>검색 중...</div>}
          {!pending && results.length === 0 && <div style={{ padding: 14, fontSize: 12, color: "var(--ink3)" }}>결과가 없습니다.</div>}
          {!pending &&
            results.map((r) => (
              <button
                key={`${r.kind}-${r.id}`}
                onClick={() => go(r)}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 12px", border: 0, borderBottom: "1px solid var(--line2)", background: "transparent", textAlign: "left", cursor: "pointer" }}
              >
                <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "var(--panel3)", color: "var(--ink2)", flex: "none" }}>{KIND_LABEL[r.kind]}</span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: "var(--ink3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.subtitle}</div>
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

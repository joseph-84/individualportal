"use client";

import { useEffect, useState } from "react";

interface FolderEntry {
  name: string;
  relPath: string;
  isDir: boolean;
}

function isKb(p: string) {
  return p === "__kb__" || p.startsWith("__kb__/");
}

function seg(on: boolean): [string, string] {
  return on ? ["var(--panel)", "var(--ink)"] : ["transparent", "var(--ink2)"];
}

function PickerNode({
  path,
  name,
  depth,
  dirCache,
  expanded,
  selected,
  onToggle,
  onSelect,
  disabledPrefix,
}: {
  path: string;
  name: string;
  depth: number;
  dirCache: Record<string, FolderEntry[]>;
  expanded: Set<string>;
  selected: string;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  disabledPrefix: string | null;
}) {
  const kids = (dirCache[path] || []).filter((e) => e.isDir && !isKb(e.relPath));
  const isExpanded = expanded.has(path);
  const isSelected = selected === path;
  const disabled = disabledPrefix !== null && (path === disabledPrefix || path.startsWith(disabledPrefix + "/"));
  const loaded = path in dirCache;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", borderRadius: 6, background: isSelected ? "var(--accent-soft)" : "transparent" }}>
        <button
          onClick={() => onToggle(path)}
          style={{ width: 18, height: 24, flex: "none", border: 0, background: "transparent", color: "var(--ink3)", cursor: "pointer", fontSize: 9, marginLeft: depth * 13 }}
        >
          {loaded && kids.length === 0 ? "" : isExpanded ? "▾" : "▸"}
        </button>
        <button
          disabled={disabled}
          onClick={() => onSelect(path)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flex: 1,
            minWidth: 0,
            padding: "4px 6px 4px 0",
            border: 0,
            background: "transparent",
            color: disabled ? "var(--ink3)" : isSelected ? "var(--accent)" : "var(--ink2)",
            opacity: disabled ? 0.5 : 1,
            fontWeight: isSelected ? 600 : 450,
            fontSize: 12.5,
            cursor: disabled ? "not-allowed" : "pointer",
            textAlign: "left",
          }}
        >
          <span style={{ fontSize: 11, opacity: 0.85, flex: "none" }}>📁</span>
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
        </button>
      </div>
      {isExpanded &&
        kids.map((k) => (
          <PickerNode
            key={k.relPath}
            path={k.relPath}
            name={k.name}
            depth={depth + 1}
            dirCache={dirCache}
            expanded={expanded}
            selected={selected}
            onToggle={onToggle}
            onSelect={onSelect}
            disabledPrefix={disabledPrefix}
          />
        ))}
    </div>
  );
}

export function MoveCopyDialog({
  relPath,
  isDir,
  onClose,
  onDone,
}: {
  relPath: string;
  isDir: boolean;
  onClose: () => void;
  onDone: (destDir: string) => void;
}) {
  const [mode, setMode] = useState<"move" | "copy">("move");
  const [dirCache, setDirCache] = useState<Record<string, FolderEntry[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set([""]));
  const [dest, setDest] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moveBg, moveFg] = seg(mode === "move");
  const [copyBg, copyFg] = seg(mode === "copy");

  const ensure = async (path: string) => {
    const res = await fetch(`/api/files?dir=${encodeURIComponent(path)}`);
    const data = await res.json();
    setDirCache((prev) => ({ ...prev, [path]: res.ok ? data.entries : [] }));
  };

  useEffect(() => {
    ensure("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(path)) n.delete(path);
      else n.add(path);
      return n;
    });
    if (!dirCache[path]) ensure(path);
  };

  const parentDir = relPath.includes("/") ? relPath.slice(0, relPath.lastIndexOf("/")) : "";
  const baseName = relPath.includes("/") ? relPath.slice(relPath.lastIndexOf("/") + 1) : relPath;

  const submit = async () => {
    setError(null);
    if (mode === "move" && dest === parentDir) {
      setError("현재 위치와 동일한 폴더입니다.");
      return;
    }
    setPending(true);
    const to = dest ? `${dest}/${baseName}` : baseName;
    const res = await fetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: mode === "move" ? "rename" : "copy", from: relPath, to }),
    });
    setPending(false);
    if (res.ok) {
      onDone(dest);
      onClose();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "작업에 실패했습니다.");
    }
  };

  const rootFolders = (dirCache[""] || []).filter((e) => e.isDir && !isKb(e.relPath));
  const disabledPrefix = isDir ? relPath : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "grid", placeItems: "center", zIndex: 50 }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          maxWidth: "90vw",
          maxHeight: "82vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: 18,
          boxShadow: "0 16px 40px rgba(0,0,0,.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>이동 / 복사</div>
          <button onClick={onClose} style={{ marginLeft: "auto", border: 0, background: "transparent", color: "var(--ink3)", cursor: "pointer", fontSize: 14 }}>
            ✕
          </button>
        </div>
        <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11.5, color: "var(--ink3)", marginBottom: 12, wordBreak: "break-all" }}>/{relPath}</div>

        <div style={{ display: "flex", padding: 2, gap: 2, border: "1px solid var(--line)", borderRadius: 8, background: "var(--panel2)", marginBottom: 12, flex: "none" }}>
          <button onClick={() => setMode("move")} style={{ flex: 1, padding: "6px 0", border: 0, borderRadius: 6, fontSize: 12.5, fontWeight: 500, cursor: "pointer", background: moveBg, color: moveFg }}>
            이동
          </button>
          <button onClick={() => setMode("copy")} style={{ flex: 1, padding: "6px 0", border: 0, borderRadius: 6, fontSize: 12.5, fontWeight: 500, cursor: "pointer", background: copyBg, color: copyFg }}>
            복사
          </button>
        </div>

        <div style={{ fontSize: 11, color: "var(--ink3)", marginBottom: 6, flex: "none" }}>대상 폴더 선택</div>
        <div style={{ flex: 1, minHeight: 160, overflow: "auto", border: "1px solid var(--line)", borderRadius: 8, padding: 6, marginBottom: 12 }}>
          <button
            onClick={() => setDest("")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              width: "100%",
              padding: "5px 6px",
              border: 0,
              borderRadius: 6,
              background: dest === "" ? "var(--accent-soft)" : "transparent",
              color: dest === "" ? "var(--accent)" : "var(--ink2)",
              fontWeight: dest === "" ? 600 : 450,
              fontSize: 12.5,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            🗂 전체 파일 (루트)
          </button>
          {rootFolders.map((f) => (
            <PickerNode
              key={f.relPath}
              path={f.relPath}
              name={f.name}
              depth={0}
              dirCache={dirCache}
              expanded={expanded}
              selected={dest}
              onToggle={toggle}
              onSelect={setDest}
              disabledPrefix={disabledPrefix}
            />
          ))}
        </div>

        {error && <div style={{ fontSize: 12, color: "var(--err)", marginBottom: 10, flex: "none" }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, flex: "none" }}>
          <button
            onClick={submit}
            disabled={pending}
            style={{ flex: 1, height: 32, border: 0, borderRadius: 7, background: "var(--accent)", color: "var(--on-accent)", fontSize: 12.5, fontWeight: 600, cursor: pending ? "default" : "pointer" }}
          >
            {pending ? "처리 중..." : mode === "move" ? "여기로 이동" : "여기로 복사"}
          </button>
          <button onClick={onClose} style={{ height: 32, padding: "0 14px", border: "1px solid var(--line)", borderRadius: 7, background: "var(--panel2)", color: "var(--ink2)", fontSize: 12.5, cursor: "pointer" }}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}

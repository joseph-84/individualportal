"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ShareDialog } from "./ShareDialog";
import { MoveCopyDialog } from "./MoveCopyDialog";

interface FileEntry {
  name: string;
  relPath: string;
  isDir: boolean;
  size: number;
  mtime: string;
  ext: string;
}

const KB_ROOT = "__kb__";
function isKb(p: string) {
  return p === KB_ROOT || p.startsWith(KB_ROOT + "/");
}

function ancestorsOf(p: string): string[] {
  if (!p) return [];
  const parts = p.split("/");
  const acc: string[] = [];
  let cur = "";
  for (let i = 0; i < parts.length - 1; i++) {
    cur = cur ? `${cur}/${parts[i]}` : parts[i];
    acc.push(cur);
  }
  return acc;
}

const EXT_COLOR: Record<string, [string, string]> = {
  MD: ["var(--accent-soft)", "var(--accent)"],
  HTML: ["var(--accent-soft)", "var(--accent)"],
  PNG: ["var(--ok-soft)", "var(--ok)"],
  JPG: ["var(--ok-soft)", "var(--ok)"],
  PDF: ["var(--err-soft)", "var(--err)"],
  CSV: ["var(--warn-soft)", "var(--warn)"],
  XLS: ["var(--ok-soft)", "var(--ok)"],
  LOG: ["var(--panel3)", "var(--ink2)"],
};

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function FolderTreeNode({
  path,
  name,
  depth,
  dir,
  dirCache,
  expanded,
  canWrite,
  onToggle,
  onSelect,
  onDeleteFolder,
  onMoveCopyFolder,
}: {
  path: string;
  name: string;
  depth: number;
  dir: string;
  dirCache: Record<string, FileEntry[]>;
  expanded: Set<string>;
  canWrite: boolean;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  onDeleteFolder: (path: string) => void;
  onMoveCopyFolder: (path: string) => void;
}) {
  const kids = (dirCache[path] || []).filter((e) => e.isDir);
  const isExpanded = expanded.has(path);
  const isActive = dir === path;
  const loaded = path in dirCache;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", borderRadius: 6, background: isActive ? "var(--accent-soft)" : "transparent" }}>
        <button
          onClick={() => onToggle(path)}
          style={{ width: 18, height: 26, flex: "none", border: 0, background: "transparent", color: "var(--ink3)", cursor: "pointer", fontSize: 9, marginLeft: depth * 13 }}
        >
          {loaded && kids.length === 0 ? "" : isExpanded ? "▾" : "▸"}
        </button>
        <button
          onClick={() => onSelect(path)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flex: 1,
            minWidth: 0,
            padding: "5px 6px 5px 0",
            border: 0,
            background: "transparent",
            color: isActive ? "var(--accent)" : "var(--ink2)",
            fontWeight: isActive ? 600 : 450,
            fontSize: 12.5,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span style={{ fontSize: 11, opacity: 0.85, flex: "none" }}>{isKb(path) ? "📚" : "📁"}</span>
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
        </button>
        {canWrite && !isKb(path) && (
          <>
            <button
              onClick={() => onMoveCopyFolder(path)}
              title="폴더 이동/복사"
              style={{ flex: "none", width: 18, height: 20, border: 0, background: "transparent", color: "var(--ink3)", cursor: "pointer", fontSize: 10.5 }}
            >
              ⇄
            </button>
            <button
              onClick={() => onDeleteFolder(path)}
              title="폴더 삭제"
              style={{ flex: "none", width: 18, height: 20, border: 0, background: "transparent", color: "var(--ink3)", cursor: "pointer", fontSize: 11 }}
            >
              ✕
            </button>
          </>
        )}
      </div>
      {isExpanded &&
        kids.map((k) => (
          <FolderTreeNode
            key={k.relPath}
            path={k.relPath}
            name={k.name}
            depth={depth + 1}
            dir={dir}
            dirCache={dirCache}
            expanded={expanded}
            canWrite={canWrite}
            onToggle={onToggle}
            onSelect={onSelect}
            onDeleteFolder={onDeleteFolder}
            onMoveCopyFolder={onMoveCopyFolder}
          />
        ))}
    </div>
  );
}

export function FilesBrowser({
  initialDir,
  initialEntries,
  usedBytes,
  canWrite,
}: {
  initialDir: string;
  initialEntries: FileEntry[];
  usedBytes: number;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [dir, setDir] = useState(initialDir);
  const [dirCache, setDirCache] = useState<Record<string, FileEntry[]>>({ [initialDir]: initialEntries });
  const [expanded, setExpanded] = useState<Set<string>>(new Set([""]));
  const [selected, setSelected] = useState<FileEntry | null>(null);
  const [preview, setPreview] = useState<{ kind: string; text?: string; html?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOverUpload, setDragOverUpload] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [movingCopying, setMovingCopying] = useState<{ relPath: string; isDir: boolean } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const inKb = isKb(dir);
  const writable = canWrite && !inKb;

  const ensureLoaded = useCallback(async (path: string, force = false): Promise<FileEntry[]> => {
    let cached: FileEntry[] | undefined;
    setDirCache((prev) => {
      cached = prev[path];
      return prev;
    });
    if (!force && cached) return cached;
    const res = await fetch(`/api/files?dir=${encodeURIComponent(path)}`);
    const data = await res.json();
    const list: FileEntry[] = res.ok ? data.entries : [];
    setDirCache((prev) => ({ ...prev, [path]: list }));
    return list;
  }, []);

  useEffect(() => {
    ensureLoaded("", true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDir = async (nextDir: string) => {
    setLoading(true);
    setSelected(null);
    setPreview(null);
    await ensureLoaded(nextDir);
    setExpanded((prev) => new Set([...prev, ...ancestorsOf(nextDir), nextDir]));
    setDir(nextDir);
    setLoading(false);
  };

  const toggleExpand = (path: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(path)) n.delete(path);
      else n.add(path);
      return n;
    });
    ensureLoaded(path);
  };

  const loadPreview = async (entry: FileEntry) => {
    setSelected(entry);
    setPreview(null);

    if (entry.ext === "MD" || entry.ext === "HTML") {
      const res = await fetch(`/api/files/render?path=${encodeURIComponent(entry.relPath)}`);
      if (res.ok) {
        const data = await res.json();
        setPreview({ kind: "doc", html: data.html });
        return;
      }
    }

    const res = await fetch(`/api/files/content?path=${encodeURIComponent(entry.relPath)}`);
    const ct = res.headers.get("content-type") || "";
    if (ct.startsWith("image/")) setPreview({ kind: "image" });
    else if (ct.includes("pdf")) setPreview({ kind: "pdf" });
    else if (ct.startsWith("text/") || ct.includes("json")) {
      const text = await res.text();
      setPreview({ kind: "text", text: text.slice(0, 200_000) });
    } else setPreview({ kind: "binary" });
  };

  const files = (dirCache[dir] || []).filter((e) => !e.isDir);
  const rootFolders = (dirCache[""] || []).filter((e) => e.isDir);

  const upload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    for (const file of Array.from(fileList)) {
      const fd = new FormData();
      fd.set("dir", dir);
      fd.set("file", file);
      await fetch("/api/files/upload", { method: "POST", body: fd });
    }
    ensureLoaded(dir, true);
  };

  const mkdir = async () => {
    const name = prompt("새 폴더 이름");
    if (!name) return;
    await fetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mkdir", dir: dir ? `${dir}/${name}` : name }),
    });
    ensureLoaded(dir, true);
  };

  const deletePath = async (relPath: string, isDir: boolean) => {
    if (!confirm(`"${relPath}"${isDir ? " 폴더" : ""}를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    await fetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", path: relPath }),
    });
    if (selected?.relPath === relPath) {
      setSelected(null);
      setPreview(null);
    }
    const parent = relPath.includes("/") ? relPath.slice(0, relPath.lastIndexOf("/")) : "";
    ensureLoaded(parent, true);
    if (isDir && dir === relPath) loadDir(parent);
  };

  const renameSelected = async () => {
    if (!selected) return;
    const newName = prompt("새 이름", selected.name);
    if (!newName || newName === selected.name) return;
    const to = dir ? `${dir}/${newName}` : newName;
    const res = await fetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rename", from: selected.relPath, to }),
    });
    if (res.ok) {
      setSelected(null);
      setPreview(null);
      ensureLoaded(dir, true);
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "이름을 변경할 수 없습니다.");
    }
  };

  const afterMoveCopy = (destDir: string) => {
    if (!movingCopying) return;
    const { relPath, isDir } = movingCopying;
    const parent = relPath.includes("/") ? relPath.slice(0, relPath.lastIndexOf("/")) : "";
    ensureLoaded(parent, true);
    if (destDir !== parent) ensureLoaded(destDir, true);
    if (selected?.relPath === relPath) {
      setSelected(null);
      setPreview(null);
    }
    if (isDir && (dir === relPath || dir.startsWith(relPath + "/"))) {
      loadDir(parent);
    }
  };

  const contentUrl = selected ? `/api/files/content?path=${encodeURIComponent(selected.relPath)}` : "";

  return (
    <div
      className="fb-grid"
      style={{
        display: "grid",
        gridTemplateColumns: selected ? "220px 250px minmax(0,1fr)" : "220px minmax(0,1fr)",
        gap: 12,
        alignItems: "start",
        overflowX: "auto",
      }}
    >
      <aside className="fb-tree" style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 10, position: "sticky", top: 70, maxHeight: "calc(100vh - 90px)", overflowY: "auto" }}>
        <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, fontWeight: 600, letterSpacing: ".1em", color: "var(--ink3)", padding: "2px 8px 8px" }}>
          FOLDERS
        </div>
        <div style={{ borderRadius: 6, background: dir === "" ? "var(--accent-soft)" : "transparent", marginBottom: 2 }}>
          <button
            onClick={() => loadDir("")}
            style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "5px 8px", border: 0, borderRadius: 6, background: "transparent", color: dir === "" ? "var(--accent)" : "var(--ink2)", fontWeight: dir === "" ? 600 : 450, fontSize: 12.5, cursor: "pointer", textAlign: "left" }}
          >
            <span style={{ fontSize: 11 }}>🗂</span>
            <span>전체 파일</span>
          </button>
        </div>
        {rootFolders.map((f) => (
          <FolderTreeNode
            key={f.relPath}
            path={f.relPath}
            name={f.name}
            depth={0}
            dir={dir}
            dirCache={dirCache}
            expanded={expanded}
            canWrite={canWrite}
            onToggle={toggleExpand}
            onSelect={loadDir}
            onDeleteFolder={(p) => deletePath(p, true)}
            onMoveCopyFolder={(p) => setMovingCopying({ relPath: p, isDir: true })}
          />
        ))}
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--line2)", fontSize: 11.5, color: "var(--ink3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span>전체 사용량</span>
            <span style={{ fontFamily: "var(--font-mono), monospace" }}>{fmtSize(usedBytes)}</span>
          </div>
        </div>
      </aside>

      <section
        onDragOver={(e) => {
          if (!writable) return;
          e.preventDefault();
          setDragOverUpload(true);
        }}
        onDragLeave={(e) => {
          if (!writable) return;
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDragOverUpload(false);
        }}
        onDrop={(e) => {
          if (!writable) return;
          e.preventDefault();
          setDragOverUpload(false);
          upload(e.dataTransfer.files);
        }}
        style={{
          background: "var(--panel)",
          border: dragOverUpload ? "2px dashed var(--accent)" : "1px solid var(--line)",
          borderRadius: 10,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {dragOverUpload && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 10,
              background: "var(--accent-soft)",
              display: "grid",
              placeItems: "center",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--accent)",
              pointerEvents: "none",
            }}
          >
            여기에 파일을 놓아 업로드
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11.5, color: "var(--ink3)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {inKb ? "지식베이스" : `/${dir}`}
          </div>
        </div>
        {writable && (
          <div style={{ display: "flex", gap: 6, padding: "8px 14px", borderBottom: "1px solid var(--line)" }}>
            <input ref={fileInput} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
            <button
              onClick={() => fileInput.current?.click()}
              style={{ height: 26, padding: "0 10px", border: 0, borderRadius: 6, background: "var(--accent)", color: "var(--on-accent)", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}
            >
              ↑ 업로드
            </button>
            <button onClick={mkdir} style={{ height: 26, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink2)", fontSize: 11.5, cursor: "pointer" }}>
              새 폴더
            </button>
          </div>
        )}
        {loading && <div style={{ padding: 20, fontSize: 12.5, color: "var(--ink3)" }}>불러오는 중...</div>}
        {!loading && files.length === 0 && <div style={{ padding: 20, fontSize: 12.5, color: "var(--ink3)" }}>이 폴더에 파일이 없습니다.</div>}
        {!loading &&
          files.map((f) => {
            const on = selected?.relPath === f.relPath;
            const [ib, ifg] = EXT_COLOR[f.ext] || ["var(--panel3)", "var(--ink2)"];
            return (
              <button
                key={f.relPath}
                onClick={() => loadPreview(f)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  width: "100%",
                  padding: "8px 14px",
                  border: 0,
                  borderBottom: "1px solid var(--line2)",
                  background: on ? "var(--accent-soft)" : "transparent",
                  color: "var(--ink)",
                  fontSize: 12.5,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <span style={{ width: 21, height: 21, flex: "none", borderRadius: 5, display: "grid", placeItems: "center", fontSize: 8.5, fontWeight: 700, background: ib, color: ifg }}>
                  {f.ext || "-"}
                </span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                {!selected && (
                  <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, color: "var(--ink3)", flex: "none" }}>{inKb ? "" : fmtSize(f.size)}</span>
                )}
              </button>
            );
          })}
      </section>

      {selected && (
        <section style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.name}</div>
            <button
              onClick={() => {
                const url =
                  selected.ext === "MD" || selected.ext === "HTML"
                    ? `/files/view?path=${encodeURIComponent(selected.relPath)}`
                    : contentUrl;
                window.open(url, "_blank", "noopener,noreferrer");
              }}
              style={{ height: 27, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink2)", fontSize: 11.5, cursor: "pointer" }}
            >
              ⤢ 새 창에서 보기
            </button>
            {!inKb && (
              <a
                href={`${contentUrl}&download=1`}
                style={{ height: 27, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink2)", fontSize: 11.5, display: "flex", alignItems: "center", textDecoration: "none" }}
              >
                ↓ 다운로드
              </a>
            )}
            {canWrite && (
              <button
                onClick={() => setSharing(true)}
                style={{ height: 27, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink2)", fontSize: 11.5, cursor: "pointer" }}
              >
                공유
              </button>
            )}
            {writable && (
              <>
                <button
                  onClick={renameSelected}
                  style={{ height: 27, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink2)", fontSize: 11.5, cursor: "pointer" }}
                >
                  이름변경
                </button>
                <button
                  onClick={() => setMovingCopying({ relPath: selected.relPath, isDir: false })}
                  style={{ height: 27, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink2)", fontSize: 11.5, cursor: "pointer" }}
                >
                  이동/복사
                </button>
                <button
                  onClick={() => deletePath(selected.relPath, false)}
                  style={{ height: 27, padding: "0 10px", border: "1px solid var(--err)", borderRadius: 6, background: "var(--err-soft)", color: "var(--err)", fontSize: 11.5, cursor: "pointer" }}
                >
                  삭제
                </button>
              </>
            )}
            {inKb && (
              <button
                onClick={() => router.push("/wiki")}
                style={{ height: 27, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink2)", fontSize: 11.5, cursor: "pointer" }}
              >
                위키에서 열기
              </button>
            )}
            <button onClick={() => { setSelected(null); setPreview(null); }} style={{ height: 27, width: 27, border: 0, background: "transparent", color: "var(--ink3)", fontSize: 15, cursor: "pointer" }}>
              ✕
            </button>
          </div>
          {!preview && <div style={{ padding: 24, fontSize: 12.5, color: "var(--ink3)" }}>불러오는 중...</div>}
          {preview?.kind === "doc" && (
            <article style={{ padding: "26px 30px", height: "calc(100vh - 220px)", minHeight: 320, overflow: "auto" }}>
              <div className="wiki-content doc-viewer" style={{ color: "var(--ink2)" }} dangerouslySetInnerHTML={{ __html: preview.html || "" }} />
            </article>
          )}
          {preview?.kind === "text" && (
            <pre
              style={{
                padding: "18px 22px",
                margin: 0,
                fontFamily: "var(--font-mono), monospace",
                fontSize: 13,
                lineHeight: 1.8,
                height: "calc(100vh - 220px)",
                minHeight: 320,
                overflow: "auto",
                color: "var(--ink2)",
                whiteSpace: "pre-wrap",
              }}
            >
              {preview.text}
            </pre>
          )}
          {preview?.kind === "image" && (
            <div style={{ padding: 20, display: "flex", justifyContent: "center", alignItems: "center", height: "calc(100vh - 220px)", minHeight: 320, overflow: "auto" }}>
              <img src={contentUrl} alt={selected.name} style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8, border: "1px solid var(--line)" }} />
            </div>
          )}
          {preview?.kind === "pdf" && <iframe src={contentUrl} style={{ width: "100%", height: "calc(100vh - 220px)", minHeight: 320, border: 0 }} />}
          {preview?.kind === "binary" && (
            <div style={{ padding: 30, fontSize: 12.5, color: "var(--ink3)", textAlign: "center" }}>미리보기를 지원하지 않는 파일 형식입니다. 새 창에서 보기 또는 다운로드를 이용하세요.</div>
          )}
          {!inKb && preview && (
            <div style={{ borderTop: "1px solid var(--line2)", padding: "12px 14px" }}>
              <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, fontWeight: 600, letterSpacing: ".1em", color: "var(--ink3)", marginBottom: 8 }}>
                METADATA
              </div>
              {[
                { k: "경로", v: `/${selected.relPath}` },
                { k: "크기", v: fmtSize(selected.size) },
                { k: "수정", v: new Date(selected.mtime).toLocaleString("ko-KR") },
              ].map((m) => (
                <div key={m.k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "3px 0", fontSize: 12 }}>
                  <span style={{ color: "var(--ink3)" }}>{m.k}</span>
                  <span style={{ fontFamily: "var(--font-mono), monospace", color: "var(--ink2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.v}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {sharing && selected && <ShareDialog relPath={selected.relPath} onClose={() => setSharing(false)} />}
      {movingCopying && (
        <MoveCopyDialog relPath={movingCopying.relPath} isDir={movingCopying.isDir} onClose={() => setMovingCopying(null)} onDone={afterMoveCopy} />
      )}
    </div>
  );
}

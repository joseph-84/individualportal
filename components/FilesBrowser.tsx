"use client";

import { useState, useRef, useEffect, useCallback, useActionState } from "react";
import { ShareDialog } from "./ShareDialog";
import { MoveCopyDialog } from "./MoveCopyDialog";
import { DocEditor } from "./DocEditor";
import { createNoteAction, type CreateNoteState } from "@/app/actions/wiki";

interface FileEntry {
  name: string;
  relPath: string;
  isDir: boolean;
  size: number;
  mtime: string;
  ext: string;
  tags?: string[];
}

const KB_ROOT = "__kb__";
const KB_UNFILED = "(미분류)";

function isKb(p: string) {
  return p === KB_ROOT || p.startsWith(KB_ROOT + "/");
}

/** The note's current folder, decoded from the __kb__/<folder> dir the tree has it open under. */
function kbFolderFromDir(dir: string): string {
  if (!isKb(dir) || dir === KB_ROOT) return "";
  const decoded = decodeURIComponent(dir.slice(KB_ROOT.length + 1));
  return decoded === KB_UNFILED ? "" : decoded;
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

function matchesFilter(entry: FileEntry, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (entry.name.toLowerCase().includes(q)) return true;
  return entry.tags?.some((t) => t.toLowerCase().includes(q)) ?? false;
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

/** Windows 탐색기 스타일 재귀 트리 -- 폴더와 파일이 같은 트리 안에 섞여 나온다(이전에는 폴더만
 * 트리에 있고 파일은 별도 플랫 목록 컬럼이었음). 지연 로딩(dirCache/ensureLoaded)은 그대로 -- 폴더를
 *펼칠 때만 그 폴더의 자식을 fetch한다. */
function TreeNode({
  path,
  name,
  entry,
  depth,
  dir,
  selectedPath,
  dirCache,
  expanded,
  filter,
  canWrite,
  onToggle,
  onSelectDir,
  onSelectFile,
  onDeleteFolder,
  onMoveCopyFolder,
}: {
  path: string;
  name: string;
  entry: FileEntry;
  depth: number;
  dir: string;
  selectedPath?: string;
  dirCache: Record<string, FileEntry[]>;
  expanded: Set<string>;
  filter: string;
  canWrite: boolean;
  onToggle: (path: string) => void;
  onSelectDir: (path: string) => void;
  onSelectFile: (entry: FileEntry) => void;
  onDeleteFolder: (path: string) => void;
  onMoveCopyFolder: (path: string) => void;
}) {
  const isExpanded = expanded.has(path);
  const loaded = path in dirCache;
  const kids = entry.isDir ? (dirCache[path] || []).filter((e) => e.isDir || matchesFilter(e, filter)) : [];
  const kb = isKb(path);
  const isActiveDir = !entry.isDir ? false : dir === path;
  const isActiveFile = !entry.isDir && selectedPath === path;
  const [ib, ifg] = !entry.isDir ? EXT_COLOR[entry.ext] || ["var(--panel3)", "var(--ink2)"] : ["", ""];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", borderRadius: 6, background: isActiveDir || isActiveFile ? "var(--accent-soft)" : "transparent" }}>
        <button
          onClick={() => (entry.isDir ? onToggle(path) : undefined)}
          style={{ width: 18, height: 26, flex: "none", border: 0, background: "transparent", color: "var(--ink3)", cursor: entry.isDir ? "pointer" : "default", fontSize: 9, marginLeft: depth * 13 }}
        >
          {!entry.isDir ? "" : loaded && kids.length === 0 ? "" : isExpanded ? "▾" : "▸"}
        </button>
        <button
          onClick={() => (entry.isDir ? onSelectDir(path) : onSelectFile(entry))}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flex: 1,
            minWidth: 0,
            padding: "5px 6px 5px 0",
            border: 0,
            background: "transparent",
            color: isActiveDir ? "var(--accent)" : isActiveFile ? "var(--accent)" : "var(--ink2)",
            fontWeight: isActiveDir || isActiveFile ? 600 : 450,
            fontSize: 12.5,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          {entry.isDir ? (
            <span style={{ fontSize: 11, opacity: 0.85, flex: "none" }}>{kb ? "📚" : "📁"}</span>
          ) : (
            <span style={{ width: 18, height: 18, flex: "none", borderRadius: 4, display: "grid", placeItems: "center", fontSize: 7.5, fontWeight: 700, background: ib, color: ifg }}>
              {entry.ext || "-"}
            </span>
          )}
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
        </button>
        {canWrite && entry.isDir && !kb && (
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
      {entry.isDir &&
        isExpanded &&
        kids.map((k) => (
          <TreeNode
            key={k.relPath}
            path={k.relPath}
            name={k.name}
            entry={k}
            depth={depth + 1}
            dir={dir}
            selectedPath={selectedPath}
            dirCache={dirCache}
            expanded={expanded}
            filter={filter}
            canWrite={canWrite}
            onToggle={onToggle}
            onSelectDir={onSelectDir}
            onSelectFile={onSelectFile}
            onDeleteFolder={onDeleteFolder}
            onMoveCopyFolder={onMoveCopyFolder}
          />
        ))}
    </div>
  );
}

const initialCreateNote: CreateNoteState = {};

/** 새 문서 만들기 -- 지식베이스 하위에서는 제목/폴더/태그/형식(노트 생성), 디스크 폴더에서는
 * 파일명/형식(새 파일 생성)으로 입력 필드가 바뀐다. */
function CreateDocForm({
  inKb,
  defaultFolder,
  onCreateDisk,
  onDone,
}: {
  inKb: boolean;
  defaultFolder: string;
  onCreateDisk: (name: string, format: "md" | "html") => Promise<string | void>;
  onDone: () => void;
}) {
  const [noteState, noteFormAction, notePending] = useActionState(createNoteAction, initialCreateNote);
  const [diskName, setDiskName] = useState("");
  const [diskFormat, setDiskFormat] = useState<"md" | "html">("md");
  const [diskPending, setDiskPending] = useState(false);
  const [diskError, setDiskError] = useState<string | null>(null);

  if (inKb) {
    return (
      <form action={noteFormAction} style={{ display: "grid", gap: 6, marginBottom: 10, padding: 8, border: "1px solid var(--line)", borderRadius: 7, background: "var(--panel2)" }}>
        <input name="title" placeholder="제목" required style={{ height: 26, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink)", fontSize: 12 }} />
        <input name="folder" placeholder="폴더 (예: Ops / 배포)" defaultValue={defaultFolder} style={{ height: 26, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink)", fontSize: 12 }} />
        <input name="tags" placeholder="태그 (쉼표로 구분)" style={{ height: 26, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink)", fontSize: 12 }} />
        <select name="format" defaultValue="md" style={{ height: 26, border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink)", fontSize: 12 }}>
          <option value="md">마크다운 (.md)</option>
          <option value="html">HTML (.html)</option>
        </select>
        <div style={{ display: "flex", gap: 5 }}>
          <button type="submit" disabled={notePending} style={{ flex: 1, height: 26, border: 0, borderRadius: 5, background: "var(--accent)", color: "var(--on-accent)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {notePending ? "생성 중..." : "생성"}
          </button>
          <button type="button" onClick={onDone} style={{ height: 26, padding: "0 9px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink2)", fontSize: 12, cursor: "pointer" }}>
            취소
          </button>
        </div>
        {noteState.error && <div style={{ fontSize: 11, color: "var(--err)" }}>{noteState.error}</div>}
      </form>
    );
  }

  const submitDisk = async () => {
    setDiskError(null);
    setDiskPending(true);
    const err = await onCreateDisk(diskName, diskFormat);
    setDiskPending(false);
    if (err) setDiskError(err);
  };

  return (
    <div style={{ display: "grid", gap: 6, marginBottom: 10, padding: 8, border: "1px solid var(--line)", borderRadius: 7, background: "var(--panel2)" }}>
      <input
        value={diskName}
        onChange={(e) => setDiskName(e.target.value)}
        placeholder="파일 이름 (확장자 제외)"
        style={{ height: 26, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink)", fontSize: 12 }}
      />
      <select value={diskFormat} onChange={(e) => setDiskFormat(e.target.value === "html" ? "html" : "md")} style={{ height: 26, border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink)", fontSize: 12 }}>
        <option value="md">마크다운 (.md)</option>
        <option value="html">HTML (.html)</option>
      </select>
      <div style={{ display: "flex", gap: 5 }}>
        <button type="button" onClick={submitDisk} disabled={diskPending} style={{ flex: 1, height: 26, border: 0, borderRadius: 5, background: "var(--accent)", color: "var(--on-accent)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          {diskPending ? "생성 중..." : "생성"}
        </button>
        <button type="button" onClick={onDone} style={{ height: 26, padding: "0 9px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--panel)", color: "var(--ink2)", fontSize: 12, cursor: "pointer" }}>
          취소
        </button>
      </div>
      {diskError && <div style={{ fontSize: 11, color: "var(--err)" }}>{diskError}</div>}
    </div>
  );
}

export function FilesBrowser({
  initialDir,
  initialEntries,
  usedBytes,
  canWrite,
  initialSelectedPath,
}: {
  initialDir: string;
  initialEntries: FileEntry[];
  usedBytes: number;
  canWrite: boolean;
  initialSelectedPath?: string;
}) {
  const [dir, setDir] = useState(initialDir);
  const [dirCache, setDirCache] = useState<Record<string, FileEntry[]>>({ [initialDir]: initialEntries });
  const [expanded, setExpanded] = useState<Set<string>>(new Set([""]));
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<FileEntry | null>(null);
  const [preview, setPreview] = useState<{ kind: string; text?: string; html?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOverUpload, setDragOverUpload] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [movingCopying, setMovingCopying] = useState<{ relPath: string; isDir: boolean } | null>(null);
  const [creatingDoc, setCreatingDoc] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // 문서(.md/.html, 디스크든 지식베이스든) 뷰어/에디터 상태 -- WikiEditor가 하던 역할을 여기로 올림.
  const [docMode, setDocMode] = useState<"view" | "edit">("view");
  const [docSource, setDocSource] = useState("");
  const [docPending, setDocPending] = useState(false);
  const [docSavedAt, setDocSavedAt] = useState<string | null>(null);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);

  const inKb = isKb(dir);
  const writable = canWrite && !inKb;
  const isDoc = selected && (selected.ext === "MD" || selected.ext === "HTML");

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

  const loadPreview = useCallback(async (entry: FileEntry) => {
    setSelected(entry);
    setPreview(null);
    setDocMode("view");
    setDocSource("");
    setDocSavedAt(null);
    setMobilePreviewOpen(false);

    if (entry.ext === "MD" || entry.ext === "HTML") {
      const [renderRes, contentRes] = await Promise.all([
        fetch(`/api/files/render?path=${encodeURIComponent(entry.relPath)}`),
        fetch(`/api/files/content?path=${encodeURIComponent(entry.relPath)}`),
      ]);
      if (renderRes.ok) {
        const data = await renderRes.json();
        setPreview({ kind: "doc", html: data.html });
      }
      if (contentRes.ok) setDocSource(await contentRes.text());
      return;
    }

    const res = await fetch(`/api/files/content?path=${encodeURIComponent(entry.relPath)}`);
    const ct = res.headers.get("content-type") || "";
    if (ct.startsWith("image/")) setPreview({ kind: "image" });
    else if (ct.includes("pdf")) setPreview({ kind: "pdf" });
    else if (ct.startsWith("text/") || ct.includes("json")) {
      const text = await res.text();
      setPreview({ kind: "text", text: text.slice(0, 200_000) });
    } else setPreview({ kind: "binary" });
  }, []);

  const selectByPath = useCallback(
    async (path: string) => {
      const chain = ancestorsOf(path);
      const parent = chain.length ? chain[chain.length - 1] : "";
      const loadedChain = await Promise.all(chain.map((p) => ensureLoaded(p)));
      const parentEntries = parent ? loadedChain[loadedChain.length - 1] : await ensureLoaded("");
      const entry = parentEntries.find((e) => e.relPath === path);
      if (!entry) return;
      setExpanded((prev) => new Set([...prev, ...chain]));
      setDir(parent);
      await loadPreview(entry);
    },
    [ensureLoaded, loadPreview]
  );

  useEffect(() => {
    ensureLoaded("", true).then(() => {
      if (initialSelectedPath) selectByPath(initialSelectedPath);
    });
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

  const rootEntries = (dirCache[""] || []).filter((e) => matchesFilter(e, filter) || e.isDir);

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

  const createDiskDoc = async (name: string, format: "md" | "html"): Promise<string | void> => {
    const trimmed = name.trim();
    if (!trimmed) return "파일 이름을 입력하세요.";
    const path = dir ? `${dir}/${trimmed}.${format}` : `${trimmed}.${format}`;
    const content = format === "html" ? `<h1>${trimmed}</h1>\n<p></p>\n` : `# ${trimmed}\n\n`;
    const res = await fetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "write", path, content }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return data.error || "만들 수 없습니다.";
    }
    setCreatingDoc(false);
    await ensureLoaded(dir, true);
    await selectByPath(path);
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

  const moveKbNoteSelected = async () => {
    if (!selected) return;
    const currentFolder = kbFolderFromDir(dir);
    const input = prompt("이동할 폴더 (지식베이스 내)", currentFolder);
    if (input === null) return;
    const folder = input.trim();
    if (folder === currentFolder) return;
    const newDir = `${KB_ROOT}/${encodeURIComponent(folder || KB_UNFILED)}`;
    const to = `${newDir}/${selected.name}`;
    const res = await fetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rename", from: selected.relPath, to }),
    });
    if (res.ok) {
      ensureLoaded(dir, true);
      ensureLoaded(newDir, true);
      setSelected(null);
      setPreview(null);
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "이동할 수 없습니다.");
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

  const saveDoc = async () => {
    if (!selected) return;
    setDocPending(true);
    const res = await fetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "write", path: selected.relPath, content: docSource }),
    });
    setDocPending(false);
    if (res.ok) {
      setDocSavedAt(new Date().toLocaleTimeString("ko-KR"));
      const renderRes = await fetch(`/api/files/render?path=${encodeURIComponent(selected.relPath)}`);
      if (renderRes.ok) {
        const data = await renderRes.json();
        setPreview((p) => (p ? { ...p, html: data.html } : p));
      }
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "저장할 수 없습니다.");
    }
  };

  const contentUrl = selected ? `/api/files/content?path=${encodeURIComponent(selected.relPath)}` : "";

  return (
    <div
      className="fb-grid"
      style={{
        display: "grid",
        gridTemplateColumns: selected ? "260px minmax(0,1fr)" : "260px minmax(0,1fr)",
        gap: 12,
        alignItems: "start",
        overflowX: "auto",
      }}
    >
      <aside className="fb-tree" style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 10, position: "sticky", top: 70, maxHeight: "calc(100vh - 90px)", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              height: 28,
              padding: "0 9px",
              flex: 1,
              minWidth: 0,
              border: "1px solid var(--line)",
              borderRadius: 7,
              background: "var(--panel2)",
              color: "var(--ink3)",
              fontSize: 12,
            }}
          >
            <span>⌕</span>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="펼친 폴더 안에서 찾기"
              style={{ border: 0, background: "transparent", outline: "none", color: "var(--ink)", fontSize: 12, width: "100%" }}
            />
          </div>
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
        {rootEntries.map((f) => (
          <TreeNode
            key={f.relPath}
            path={f.relPath}
            name={f.name}
            entry={f}
            depth={0}
            dir={dir}
            selectedPath={selected?.relPath}
            dirCache={dirCache}
            expanded={expanded}
            filter={filter}
            canWrite={canWrite}
            onToggle={toggleExpand}
            onSelectDir={loadDir}
            onSelectFile={loadPreview}
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
          minHeight: 200,
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

        {!selected && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>
              <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11.5, color: "var(--ink3)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {inKb ? "지식베이스" : dir ? `/${dir}` : "/ (전체 파일)"}
              </div>
            </div>
            {canWrite && (
              <div style={{ display: "flex", gap: 6, padding: "8px 14px", borderBottom: "1px solid var(--line)" }}>
                {!inKb && <input ref={fileInput} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />}
                {!inKb && (
                  <button
                    onClick={() => fileInput.current?.click()}
                    style={{ height: 26, padding: "0 10px", border: 0, borderRadius: 6, background: "var(--accent)", color: "var(--on-accent)", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}
                  >
                    ↑ 업로드
                  </button>
                )}
                <button
                  onClick={() => setCreatingDoc((v) => !v)}
                  style={{ height: 26, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink2)", fontSize: 11.5, cursor: "pointer" }}
                >
                  + 새 문서
                </button>
                {!inKb && (
                  <button onClick={mkdir} style={{ height: 26, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink2)", fontSize: 11.5, cursor: "pointer" }}>
                    새 폴더
                  </button>
                )}
              </div>
            )}
            {creatingDoc && canWrite && (
              <div style={{ padding: "10px 14px 0" }}>
                <CreateDocForm inKb={inKb} defaultFolder={kbFolderFromDir(dir)} onCreateDisk={createDiskDoc} onDone={() => setCreatingDoc(false)} />
              </div>
            )}
            {loading && <div style={{ padding: 20, fontSize: 12.5, color: "var(--ink3)" }}>불러오는 중...</div>}
            <div style={{ padding: 30, fontSize: 12.5, color: "var(--ink3)", textAlign: "center" }}>
              왼쪽 트리에서 폴더나 문서를 선택하세요.
            </div>
          </>
        )}

        {selected && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.name}</div>
              {isDoc && canWrite && (
                <>
                  <div style={{ display: "flex", padding: 2, gap: 2, border: "1px solid var(--line)", borderRadius: 7, background: "var(--panel2)" }}>
                    <button
                      onClick={() => setDocMode("view")}
                      style={{ padding: "4px 11px", border: 0, borderRadius: 5, fontSize: 12, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", background: docMode === "view" ? "var(--panel)" : "transparent", color: docMode === "view" ? "var(--ink)" : "var(--ink2)" }}
                    >
                      뷰어
                    </button>
                    <button
                      onClick={() => setDocMode("edit")}
                      style={{ padding: "4px 11px", border: 0, borderRadius: 5, fontSize: 12, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", background: docMode === "edit" ? "var(--panel)" : "transparent", color: docMode === "edit" ? "var(--ink)" : "var(--ink2)" }}
                    >
                      에디터
                    </button>
                  </div>
                  {docMode === "edit" && (
                    <span style={{ fontSize: 11.5, color: "var(--ink3)" }}>
                      {docPending ? "저장 중..." : docSavedAt ? `${docSavedAt} 저장됨` : `최종 수정 ${new Date(selected.mtime).toLocaleString("ko-KR")}`}
                    </span>
                  )}
                  {docMode === "edit" && (
                    <button
                      onClick={saveDoc}
                      disabled={docPending}
                      style={{ height: 26, padding: "0 12px", border: 0, borderRadius: 6, background: "var(--accent)", color: "var(--on-accent)", fontSize: 12, fontWeight: 600, cursor: docPending ? "default" : "pointer", opacity: docPending ? 0.6 : 1 }}
                    >
                      저장
                    </button>
                  )}
                  {docMode === "edit" && selected.ext === "MD" && (
                    <button
                      className="wiki-mobile-preview-btn"
                      onClick={() => setMobilePreviewOpen(true)}
                      style={{ height: 26, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel)", color: "var(--ink2)", fontSize: 11.5, cursor: "pointer" }}
                    >
                      미리보기
                    </button>
                  )}
                </>
              )}
              <button
                onClick={() => {
                  const url = isDoc ? `/files/view?path=${encodeURIComponent(selected.relPath)}` : contentUrl;
                  window.open(url, "_blank", "noopener,noreferrer");
                }}
                style={{ height: 27, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink2)", fontSize: 11.5, cursor: "pointer" }}
              >
                ⤢ 새 창에서 보기
              </button>
              <a
                href={`${contentUrl}&download=1`}
                style={{ height: 27, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink2)", fontSize: 11.5, display: "flex", alignItems: "center", textDecoration: "none" }}
              >
                ↓ 다운로드
              </a>
              {canWrite && (
                <button
                  onClick={() => setSharing(true)}
                  style={{ height: 27, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink2)", fontSize: 11.5, cursor: "pointer" }}
                >
                  공유
                </button>
              )}
              {canWrite && (
                <>
                  <button
                    onClick={renameSelected}
                    style={{ height: 27, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink2)", fontSize: 11.5, cursor: "pointer" }}
                  >
                    이름변경
                  </button>
                  <button
                    onClick={() => (inKb ? moveKbNoteSelected() : setMovingCopying({ relPath: selected.relPath, isDir: false }))}
                    style={{ height: 27, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink2)", fontSize: 11.5, cursor: "pointer" }}
                  >
                    {inKb ? "폴더 이동" : "이동/복사"}
                  </button>
                  <button
                    onClick={() => deletePath(selected.relPath, false)}
                    style={{ height: 27, padding: "0 10px", border: "1px solid var(--err)", borderRadius: 6, background: "var(--err-soft)", color: "var(--err)", fontSize: 11.5, cursor: "pointer" }}
                  >
                    삭제
                  </button>
                </>
              )}
              <button onClick={() => { setSelected(null); setPreview(null); }} style={{ height: 27, width: 27, border: 0, background: "transparent", color: "var(--ink3)", fontSize: 15, cursor: "pointer" }}>
                ✕
              </button>
            </div>
            {!preview && <div style={{ padding: 24, fontSize: 12.5, color: "var(--ink3)" }}>불러오는 중...</div>}
            {preview?.kind === "doc" && (
              <DocEditor
                mode={canWrite ? docMode : "view"}
                title={selected.name.replace(/\.(md|html)$/i, "")}
                format={selected.ext.toLowerCase()}
                html={preview.html || ""}
                source={docSource}
                onSourceChange={setDocSource}
                mobilePreviewOpen={mobilePreviewOpen}
                onCloseMobilePreview={() => setMobilePreviewOpen(false)}
              />
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
            {preview && (
              <div style={{ borderTop: "1px solid var(--line2)", padding: "12px 14px" }}>
                <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, fontWeight: 600, letterSpacing: ".1em", color: "var(--ink3)", marginBottom: 8 }}>
                  METADATA
                </div>
                {[
                  { k: "경로", v: `/${selected.relPath.replace(/^__kb__\//, "지식베이스/")}` },
                  { k: "크기", v: fmtSize(selected.size) },
                  { k: "수정", v: new Date(selected.mtime).toLocaleString("ko-KR") },
                ].map((m) => (
                  <div key={m.k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "3px 0", fontSize: 12 }}>
                    <span style={{ color: "var(--ink3)" }}>{m.k}</span>
                    <span style={{ fontFamily: "var(--font-mono), monospace", color: "var(--ink2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.v}</span>
                  </div>
                ))}
                {inKb && selected.tags && selected.tags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                    {selected.tags.map((t) => (
                      <span key={t} style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 999, border: "1px solid var(--line)", color: "var(--ink2)", background: "var(--panel2)" }}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>
      {sharing && selected && <ShareDialog relPath={selected.relPath} onClose={() => setSharing(false)} />}
      {movingCopying && (
        <MoveCopyDialog relPath={movingCopying.relPath} isDir={movingCopying.isDir} onClose={() => setMovingCopying(null)} onDone={afterMoveCopy} />
      )}
    </div>
  );
}

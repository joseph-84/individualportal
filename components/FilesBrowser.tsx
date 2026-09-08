"use client";

import { useEffect, useState, useRef } from "react";

interface FileEntry {
  name: string;
  relPath: string;
  isDir: boolean;
  size: number;
  mtime: string;
  ext: string;
}

const EXT_COLOR: Record<string, [string, string]> = {
  MD: ["var(--accent-soft)", "var(--accent)"],
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
  const [dir, setDir] = useState(initialDir);
  const [entries, setEntries] = useState(initialEntries);
  const [selected, setSelected] = useState<FileEntry | null>(null);
  const [preview, setPreview] = useState<{ kind: string; text?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadDir = async (nextDir: string) => {
    setLoading(true);
    const res = await fetch(`/api/files?dir=${encodeURIComponent(nextDir)}`);
    const data = await res.json();
    if (res.ok) {
      setDir(nextDir);
      setEntries(data.entries);
      setSelected(null);
      setPreview(null);
    }
    setLoading(false);
  };

  const loadPreview = async (entry: FileEntry) => {
    setSelected(entry);
    setPreview(null);
    const res = await fetch(`/api/files/content?path=${encodeURIComponent(entry.relPath)}`);
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const data = await res.json();
      setPreview(data);
    } else {
      setPreview({ kind: ct.includes("image") ? "image" : ct.includes("pdf") ? "pdf" : "binary" });
    }
  };

  const folders = entries.filter((e) => e.isDir);
  const files = entries.filter((e) => !e.isDir);

  const upload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const fd = new FormData();
    fd.set("dir", dir);
    fd.set("file", fileList[0]);
    await fetch("/api/files/upload", { method: "POST", body: fd });
    loadDir(dir);
  };

  const mkdir = async () => {
    const name = prompt("새 폴더 이름");
    if (!name) return;
    await fetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mkdir", dir: dir ? `${dir}/${name}` : name }),
    });
    loadDir(dir);
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
    loadDir(dir);
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
      loadDir(dir);
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "이름을 변경할 수 없습니다.");
    }
  };

  const crumbs = dir ? dir.split("/") : [];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "208px minmax(360px,1.3fr) minmax(280px,1fr)", gap: 12, alignItems: "start", overflowX: "auto" }}>
      <aside style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 10, position: "sticky", top: 70 }}>
        <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, fontWeight: 600, letterSpacing: ".1em", color: "var(--ink3)", padding: "2px 8px 8px" }}>
          FOLDERS
        </div>
        {dir && (
          <button
            onClick={() => loadDir(crumbs.slice(0, -1).join("/"))}
            style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "5px 8px", border: 0, borderRadius: 6, background: "transparent", color: "var(--ink2)", fontSize: 12.5, cursor: "pointer", textAlign: "left" }}
          >
            <span>‹</span>
            <span>.. 상위 폴더</span>
          </button>
        )}
        {folders.map((f) => (
          <div key={f.relPath} style={{ display: "flex", alignItems: "center" }}>
            <button
              onClick={() => loadDir(f.relPath)}
              style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0, padding: "5px 8px", border: 0, borderRadius: 6, background: "transparent", color: "var(--ink2)", fontSize: 12.5, fontWeight: 450, cursor: "pointer", textAlign: "left" }}
            >
              <span style={{ fontSize: 11, opacity: 0.75 }}>▸</span>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
            </button>
            {canWrite && (
              <button
                onClick={() => deletePath(f.relPath, true)}
                title="폴더 삭제"
                style={{ flex: "none", width: 20, height: 20, border: 0, background: "transparent", color: "var(--ink3)", cursor: "pointer", fontSize: 12 }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--line2)", fontSize: 11.5, color: "var(--ink3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span>전체 사용량</span>
            <span style={{ fontFamily: "var(--font-mono), monospace" }}>{fmtSize(usedBytes)}</span>
          </div>
        </div>
      </aside>

      <section style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11.5, color: "var(--ink3)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            /{dir}
          </div>
          {canWrite && (
            <>
              <input ref={fileInput} type="file" hidden onChange={(e) => upload(e.target.files)} />
              <button
                onClick={() => fileInput.current?.click()}
                style={{ height: 28, padding: "0 11px", border: 0, borderRadius: 7, background: "var(--accent)", color: "var(--on-accent)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                ↑ 업로드
              </button>
              <button onClick={mkdir} style={{ height: 28, padding: "0 11px", border: "1px solid var(--line)", borderRadius: 7, background: "var(--panel2)", color: "var(--ink2)", fontSize: 12, cursor: "pointer" }}>
                새 폴더
              </button>
            </>
          )}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) 74px 96px",
            gap: 10,
            padding: "8px 14px",
            background: "var(--panel2)",
            borderBottom: "1px solid var(--line)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: ".04em",
            color: "var(--ink3)",
          }}
        >
          <div>이름</div>
          <div>크기</div>
          <div>수정일</div>
        </div>
        {loading && <div style={{ padding: 20, fontSize: 12.5, color: "var(--ink3)" }}>불러오는 중...</div>}
        {!loading && files.length === 0 && <div style={{ padding: 20, fontSize: 12.5, color: "var(--ink3)" }}>이 폴더에 파일이 없습니다.</div>}
        {files.map((f) => {
          const on = selected?.relPath === f.relPath;
          const [ib, ifg] = EXT_COLOR[f.ext] || ["var(--panel3)", "var(--ink2)"];
          return (
            <button
              key={f.relPath}
              onClick={() => loadPreview(f)}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) 74px 96px",
                gap: 10,
                alignItems: "center",
                width: "100%",
                padding: "8px 14px",
                border: 0,
                borderBottom: "1px solid var(--line2)",
                background: on ? "var(--accent-soft)" : "transparent",
                color: "var(--ink)",
                fontSize: 13,
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                <span style={{ width: 21, height: 21, flex: "none", borderRadius: 5, display: "grid", placeItems: "center", fontSize: 8.5, fontWeight: 700, background: ib, color: ifg }}>
                  {f.ext || "-"}
                </span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
              </span>
              <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11.5, color: "var(--ink2)" }}>{fmtSize(f.size)}</span>
              <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11.5, color: "var(--ink3)" }}>{new Date(f.mtime).toLocaleDateString("ko-KR")}</span>
            </button>
          );
        })}
      </section>

      <section style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", position: "sticky", top: 70 }}>
        {!selected && <div style={{ padding: 30, textAlign: "center", color: "var(--ink3)", fontSize: 12.5 }}>파일을 선택하면 미리보기가 표시됩니다.</div>}
        {selected && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.name}</div>
              <a
                href={`/api/files/content?path=${encodeURIComponent(selected.relPath)}&download=1`}
                style={{ height: 26, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink2)", fontSize: 11.5, display: "flex", alignItems: "center", textDecoration: "none" }}
              >
                ↓ 다운로드
              </a>
              {canWrite && (
                <>
                  <button
                    onClick={renameSelected}
                    style={{ height: 26, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink2)", fontSize: 11.5, cursor: "pointer" }}
                  >
                    이름변경
                  </button>
                  <button
                    onClick={() => deletePath(selected.relPath, false)}
                    style={{ height: 26, padding: "0 10px", border: "1px solid var(--err)", borderRadius: 6, background: "var(--err-soft)", color: "var(--err)", fontSize: 11.5, cursor: "pointer" }}
                  >
                    삭제
                  </button>
                </>
              )}
            </div>
            {!preview && <div style={{ padding: 20, fontSize: 12, color: "var(--ink3)" }}>불러오는 중...</div>}
            {preview?.kind === "text" && (
              <pre style={{ padding: "12px 14px", margin: 0, fontFamily: "var(--font-mono), monospace", fontSize: 11.5, lineHeight: 1.8, maxHeight: 320, overflow: "auto", color: "var(--ink2)", whiteSpace: "pre-wrap" }}>
                {preview.text}
              </pre>
            )}
            {preview?.kind === "image" && (
              <div style={{ padding: 14 }}>
                <img src={`/api/files/content?path=${encodeURIComponent(selected.relPath)}`} alt={selected.name} style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid var(--line)" }} />
              </div>
            )}
            {preview?.kind === "pdf" && (
              <div style={{ padding: 14 }}>
                <iframe src={`/api/files/content?path=${encodeURIComponent(selected.relPath)}`} style={{ width: "100%", height: 300, border: "1px solid var(--line)", borderRadius: 8 }} />
              </div>
            )}
            {preview?.kind === "binary" && <div style={{ padding: 20, fontSize: 12, color: "var(--ink3)" }}>미리보기를 지원하지 않는 파일 형식입니다.</div>}
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
          </>
        )}
      </section>
    </div>
  );
}

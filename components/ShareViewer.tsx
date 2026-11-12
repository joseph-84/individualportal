"use client";

import { useEffect, useState } from "react";
import { RichDocEditor } from "./RichDocEditor";
import { DOC_SLASH_ITEMS } from "./tiptap/items";

export function ShareViewer({
  token,
  fileName,
  kind,
  ext,
  editable = false,
}: {
  token: string;
  fileName: string;
  kind: "text" | "image" | "pdf" | "html" | "binary";
  ext?: string;
  editable?: boolean;
}) {
  const rawUrl = `/share/${token}/raw`;
  // Editing needs the original, unsanitized source -- the plain GET response for an html/md
  // file is a sanitized rendered document (see raw/route.ts), so ?download=1 is the only way
  // to get the raw bytes back out (the Content-Disposition header it sets only matters for a
  // direct browser navigation, not for fetch()).
  const sourceUrl = kind === "html" ? `${rawUrl}?download=1` : rawUrl;
  const [text, setText] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    if (kind !== "text" && !(kind === "html" && editable)) return;
    fetch(sourceUrl)
      .then((r) => r.text())
      .then(setText)
      .catch(() => setText("(미리보기를 불러올 수 없습니다)"));
  }, [kind, editable, sourceUrl]);

  const save = async (content: string) => {
    setSaveState("saving");
    try {
      const res = await fetch(rawUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
      setSaveState(res.ok ? "saved" : "error");
    } catch {
      setSaveState("error");
    }
  };

  const saveLabel = { idle: "", saving: "저장 중...", saved: "저장됨", error: "저장 실패" }[saveState];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <h1 style={{ fontSize: 16, margin: 0, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName}</h1>
        {saveLabel && <span style={{ fontSize: 11.5, color: saveState === "error" ? "#a83326" : "#57534d", flex: "none" }}>{saveLabel}</span>}
        <a
          href={`${rawUrl}?download=1`}
          style={{ height: 32, padding: "0 12px", border: "1px solid #e4e0da", borderRadius: 7, background: "#fbfaf8", color: "#1b1a18", fontSize: 12.5, display: "flex", alignItems: "center", textDecoration: "none", flex: "none" }}
        >
          ↓ 다운로드
        </a>
      </div>

      {kind === "text" && editable && (
        <textarea
          value={text ?? ""}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => text !== null && save(text)}
          style={{ width: "100%", minHeight: 420, maxHeight: 620, padding: 14, background: "#fbfaf8", border: "1px solid #e4e0da", borderRadius: 8, fontSize: 12, lineHeight: 1.7, fontFamily: "ui-monospace, monospace", resize: "vertical" }}
        />
      )}
      {kind === "text" && !editable && (
        <pre style={{ maxHeight: 420, overflow: "auto", padding: 14, background: "#fbfaf8", border: "1px solid #e4e0da", borderRadius: 8, fontSize: 12, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
          {text ?? "불러오는 중..."}
        </pre>
      )}
      {kind === "image" && <img src={rawUrl} alt={fileName} style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid #e4e0da" }} />}
      {kind === "pdf" && <iframe src={rawUrl} style={{ width: "100%", height: 480, border: "1px solid #e4e0da", borderRadius: 8 }} />}
      {kind === "html" && editable && text !== null && (
        <RichDocEditor
          format={ext === "MD" ? "md" : "html"}
          defaultValue={text}
          onChange={() => {}}
          onBlur={(content) => save(content)}
          slashItems={DOC_SLASH_ITEMS}
        />
      )}
      {kind === "html" && !editable && <iframe src={rawUrl} sandbox="" style={{ width: "100%", height: "80vh", minHeight: 480, border: "1px solid #e4e0da", borderRadius: 8, background: "#fff" }} />}
      {kind === "binary" && <div style={{ fontSize: 13, color: "#57534d" }}>미리보기를 지원하지 않는 형식입니다. 다운로드해주세요.</div>}
    </div>
  );
}

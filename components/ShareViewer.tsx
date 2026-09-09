"use client";

import { useEffect, useState } from "react";

export function ShareViewer({ token, fileName, kind }: { token: string; fileName: string; kind: "text" | "image" | "pdf" | "html" | "binary" }) {
  const rawUrl = `/share/${token}/raw`;
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (kind !== "text") return;
    fetch(rawUrl)
      .then((r) => r.text())
      .then(setText)
      .catch(() => setText("(미리보기를 불러올 수 없습니다)"));
  }, [kind, rawUrl]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <h1 style={{ fontSize: 16, margin: 0, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName}</h1>
        <a
          href={`${rawUrl}?download=1`}
          style={{ height: 32, padding: "0 12px", border: "1px solid #e4e0da", borderRadius: 7, background: "#fbfaf8", color: "#1b1a18", fontSize: 12.5, display: "flex", alignItems: "center", textDecoration: "none", flex: "none" }}
        >
          ↓ 다운로드
        </a>
      </div>

      {kind === "text" && (
        <pre style={{ maxHeight: 420, overflow: "auto", padding: 14, background: "#fbfaf8", border: "1px solid #e4e0da", borderRadius: 8, fontSize: 12, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
          {text ?? "불러오는 중..."}
        </pre>
      )}
      {kind === "image" && <img src={rawUrl} alt={fileName} style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid #e4e0da" }} />}
      {kind === "pdf" && <iframe src={rawUrl} style={{ width: "100%", height: 480, border: "1px solid #e4e0da", borderRadius: 8 }} />}
      {kind === "html" && <iframe src={rawUrl} sandbox="" style={{ width: "100%", height: 640, border: "1px solid #e4e0da", borderRadius: 8, background: "#fff" }} />}
      {kind === "binary" && <div style={{ fontSize: 13, color: "#57534d" }}>미리보기를 지원하지 않는 형식입니다. 다운로드해주세요.</div>}
    </div>
  );
}

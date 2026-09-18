"use client";

import { useRef, useState, useTransition } from "react";
import { saveChecklistAction, deleteChecklistAction, toggleChecklistItemAction } from "@/app/actions/checklists";
import { WikiHtmlEditor } from "./WikiHtmlEditor";

interface Props {
  checklistId: string;
  path: string;
  title: string;
  content: string;
  html: string;
  updatedAt: string;
  canWrite: boolean;
}

function seg(on: boolean): [string, string] {
  return on ? ["var(--panel)", "var(--ink)"] : ["transparent", "var(--ink2)"];
}

/** Event-delegation click handler for the read-only checklist render: if the click landed on a
 * task-item checkbox, works out its index among all checkboxes in the document and persists
 * the toggle -- lets checklist items be checked off directly, without opening the editor
 * (same pattern as the todo description checkbox in TodosClient/handleDescriptionClick). */
function handleChecklistClick(e: React.MouseEvent<HTMLDivElement>, checklistId: string, canWrite: boolean, startTransition: (cb: () => void) => void) {
  if (!canWrite) return;
  const target = e.target as HTMLElement;
  if (target.tagName !== "INPUT" || (target as HTMLInputElement).type !== "checkbox") return;
  const checkboxes = Array.from(e.currentTarget.querySelectorAll('input[type="checkbox"]'));
  const idx = checkboxes.indexOf(target as HTMLInputElement);
  if (idx === -1) return;
  startTransition(() => toggleChecklistItemAction(checklistId, idx));
}

export function ChecklistDoc({ checklistId, path, title, content, html, updatedAt, canWrite }: Props) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [source, setSource] = useState(content);
  const [pending, startTransition] = useTransition();
  const [checkPending, startCheckTransition] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [viewBg, viewFg] = seg(mode === "view");
  const [editBg, editFg] = seg(mode === "edit");
  const viewRef = useRef<HTMLDivElement>(null);

  const save = () => {
    startTransition(async () => {
      await saveChecklistAction(checklistId, source);
      setSavedAt(new Date().toLocaleTimeString("ko-KR"));
    });
  };

  const remove = () => {
    if (!confirm(`"${title}" 체크리스트를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    startDelete(() => deleteChecklistAction(checklistId));
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 15px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11.5, color: "var(--ink3)" }}>{path}</div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ fontSize: 11.5, color: "var(--ink3)" }}>
            {pending ? "저장 중..." : savedAt ? `${savedAt} 저장됨` : `최종 수정 ${new Date(updatedAt).toLocaleString("ko-KR")}`}
          </span>
          {canWrite && (
            <>
              <div style={{ display: "flex", padding: 2, gap: 2, border: "1px solid var(--line)", borderRadius: 7, background: "var(--panel2)" }}>
                <button
                  onClick={() => setMode("view")}
                  style={{ padding: "4px 11px", border: 0, borderRadius: 5, fontSize: 12, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", background: viewBg, color: viewFg }}
                >
                  뷰어
                </button>
                <button
                  onClick={() => setMode("edit")}
                  style={{ padding: "4px 11px", border: 0, borderRadius: 5, fontSize: 12, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", background: editBg, color: editFg }}
                >
                  에디터
                </button>
              </div>
              {mode === "edit" && (
                <button
                  onClick={save}
                  disabled={pending}
                  style={{ height: 26, padding: "0 12px", border: 0, borderRadius: 6, background: "var(--accent)", color: "var(--on-accent)", fontSize: 12, fontWeight: 600, cursor: pending ? "default" : "pointer", opacity: pending ? 0.6 : 1 }}
                >
                  저장
                </button>
              )}
              <button
                onClick={remove}
                disabled={deleting}
                title="체크리스트 삭제"
                style={{ height: 26, padding: "0 10px", border: "1px solid var(--err)", borderRadius: 6, background: "var(--err-soft)", color: "var(--err)", fontSize: 11.5, cursor: deleting ? "default" : "pointer" }}
              >
                {deleting ? "삭제 중..." : "삭제"}
              </button>
            </>
          )}
        </div>
      </div>

      {mode === "view" && (
        <article style={{ padding: "26px 30px" }}>
          <h1 style={{ margin: "0 0 16px", fontSize: 23, fontWeight: 600, letterSpacing: "-.02em" }}>{title}</h1>
          {html ? (
            <div
              ref={viewRef}
              className="wiki-content rich-text-content"
              style={{ color: "var(--ink2)", fontSize: 14, opacity: checkPending ? 0.7 : 1 }}
              onClick={(e) => handleChecklistClick(e, checklistId, canWrite, startCheckTransition)}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>
              {canWrite ? '아직 항목이 없습니다. "에디터"에서 ☑ 버튼으로 체크리스트 항목을 추가하세요.' : "항목이 없습니다."}
            </div>
          )}
        </article>
      )}

      {mode === "edit" && canWrite && (
        <div style={{ padding: "18px 20px" }}>
          <WikiHtmlEditor defaultValue={source} onChange={setSource} />
        </div>
      )}
    </>
  );
}

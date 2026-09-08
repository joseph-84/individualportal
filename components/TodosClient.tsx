"use client";

import { useMemo, useState, useTransition } from "react";
import { createTodoAction, deleteTodoAction } from "@/app/actions/todos";
import { TodoCheckbox } from "./TodoCheckbox";

interface TodoItem {
  id: string;
  title: string;
  project: string | null;
  repeat: string | null;
  tag: string;
  done: boolean;
  dueAt: string | null;
}

const CHIP: Record<string, [string, string]> = {
  업무: ["var(--accent-soft)", "var(--accent)"],
  반복: ["var(--ok-soft)", "var(--ok)"],
  개인: ["var(--panel3)", "var(--ink2)"],
  마감: ["var(--err-soft)", "var(--err)"],
};

function seg(on: boolean): [string, string] {
  return on ? ["var(--panel)", "var(--ink)"] : ["transparent", "var(--ink2)"];
}

const FILTERS = ["전체", "오늘", "이번 주", "반복만"] as const;
type Filter = (typeof FILTERS)[number];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function TodosClient({ todos, canWrite }: { todos: TodoItem[]; canWrite: boolean }) {
  const [view, setView] = useState<"list" | "cal">("list");
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<Filter>("전체");
  const [, startTransition] = useTransition();
  const [listBg, listFg] = seg(view === "list");
  const [calBg, calFg] = seg(view === "cal");

  const filteredTodos = useMemo(() => {
    if (filter === "전체") return todos;
    if (filter === "반복만") return todos.filter((t) => !!t.repeat);
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + (7 - now.getDay()));
    return todos.filter((t) => {
      if (!t.dueAt) return false;
      const d = new Date(t.dueAt);
      if (filter === "오늘") return isSameDay(d, now);
      if (filter === "이번 주") return d >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) && d <= weekEnd;
      return true;
    });
  }, [todos, filter]);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const eventsByDay = new Map<number, TodoItem[]>();
  for (const t of todos) {
    if (!t.dueAt) continue;
    const d = new Date(t.dueAt);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const list = eventsByDay.get(d.getDate()) || [];
      list.push(t);
      eventsByDay.set(d.getDate(), list);
    }
  }
  const calDays = [];
  for (let i = -firstWeekday; i < daysInMonth + (7 - ((firstWeekday + daysInMonth) % 7 || 7)); i++) {
    const day = i + 1;
    const inMonth = day >= 1 && day <= daysInMonth;
    const today = inMonth && day === now.getDate();
    const evs = inMonth ? eventsByDay.get(day) || [] : [];
    calDays.push({ day, inMonth, today, evs });
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", padding: 2, gap: 2, border: "1px solid var(--line)", borderRadius: 8, background: "var(--panel2)" }}>
          <button
            onClick={() => setView("list")}
            style={{ padding: "5px 13px", border: 0, borderRadius: 6, fontSize: 12.5, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", background: listBg, color: listFg }}
          >
            리스트
          </button>
          <button
            onClick={() => setView("cal")}
            style={{ padding: "5px 13px", border: 0, borderRadius: 6, fontSize: 12.5, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", background: calBg, color: calFg }}
          >
            캘린더
          </button>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {FILTERS.map((f) => {
            const on = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "5px 11px",
                  border: `1px solid ${on ? "var(--accent)" : "var(--line)"}`,
                  borderRadius: 999,
                  background: on ? "var(--accent-soft)" : "var(--panel)",
                  color: on ? "var(--accent)" : "var(--ink2)",
                  fontSize: 12,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {f}
              </button>
            );
          })}
        </div>
        {canWrite && (
          <button
            onClick={() => setShowForm((v) => !v)}
            style={{ marginLeft: "auto", height: 30, padding: "0 13px", border: 0, borderRadius: 7, background: "var(--accent)", color: "var(--on-accent)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            + 새 할일
          </button>
        )}
      </div>

      {showForm && canWrite && (
        <form
          action={(fd) => {
            startTransition(() => createTodoAction(fd));
            setShowForm(false);
          }}
          style={{ display: "flex", gap: 8, marginBottom: 12, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: 12, flexWrap: "wrap" }}
        >
          <input name="title" placeholder="제목" required style={{ flex: 1, minWidth: 160, height: 32, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink)", fontSize: 12.5 }} />
          <input name="project" placeholder="프로젝트" style={{ width: 120, height: 32, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink)", fontSize: 12.5 }} />
          <input name="dueAt" type="date" style={{ height: 32, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink)", fontSize: 12.5 }} />
          <input name="repeat" placeholder="반복 (예: 매일)" style={{ width: 110, height: 32, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink)", fontSize: 12.5 }} />
          <select name="tag" style={{ height: 32, border: "1px solid var(--line)", borderRadius: 6, background: "var(--panel2)", color: "var(--ink)", fontSize: 12.5 }}>
            <option value="업무">업무</option>
            <option value="반복">반복</option>
            <option value="개인">개인</option>
            <option value="마감">마감</option>
          </select>
          <button type="submit" style={{ height: 32, padding: "0 14px", border: 0, borderRadius: 6, background: "var(--accent)", color: "var(--on-accent)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            추가
          </button>
        </form>
      )}

      {view === "list" && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, overflowX: "auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "26px minmax(200px,1fr) 108px 100px 104px 84px 30px",
              gap: 10,
              padding: "9px 15px",
              minWidth: 780,
              background: "var(--panel2)",
              borderBottom: "1px solid var(--line)",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: ".04em",
              color: "var(--ink3)",
            }}
          >
            <div></div>
            <div>제목</div>
            <div>프로젝트</div>
            <div>마감일</div>
            <div>반복</div>
            <div>분류</div>
            <div></div>
          </div>
          {filteredTodos.length === 0 && <div style={{ padding: "24px 15px", fontSize: 12.5, color: "var(--ink3)" }}>표시할 할일이 없습니다.</div>}
          {filteredTodos.map((t) => {
            const [tagBg, tagFg] = CHIP[t.tag] || CHIP.개인;
            return (
              <div
                key={t.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "26px minmax(200px,1fr) 108px 100px 104px 84px 30px",
                  gap: 10,
                  alignItems: "center",
                  padding: "9px 15px",
                  minWidth: 780,
                  borderBottom: "1px solid var(--line2)",
                }}
              >
                <TodoCheckbox id={t.id} done={t.done} canWrite={canWrite} />
                <div
                  style={{
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontSize: 13,
                    color: t.done ? "var(--ink3)" : "var(--ink)",
                    textDecoration: t.done ? "line-through" : "none",
                  }}
                >
                  {t.title}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink2)" }}>{t.project || "—"}</div>
                <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11.5, color: "var(--ink3)" }}>
                  {t.dueAt ? new Date(t.dueAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }) : "—"}
                </div>
                <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11.5, color: "var(--ink3)" }}>{t.repeat || "—"}</div>
                <div>
                  <span style={{ fontSize: 10.5, fontWeight: 500, padding: "2px 8px", borderRadius: 999, background: tagBg, color: tagFg }}>{t.tag}</span>
                </div>
                {canWrite ? (
                  <button
                    onClick={() => startTransition(() => deleteTodoAction(t.id))}
                    title="삭제"
                    style={{ width: 22, height: 22, border: 0, background: "transparent", color: "var(--ink3)", cursor: "pointer", fontSize: 12 }}
                  >
                    ✕
                  </button>
                ) : (
                  <div />
                )}
              </div>
            );
          })}
        </div>
      )}

      {view === "cal" && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 15px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>
              {year}년 {month + 1}월
            </div>
            <div style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--ink3)" }}>마감일(dueAt)이 설정된 할일만 표시됩니다</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", background: "var(--panel2)", borderBottom: "1px solid var(--line2)" }}>
            {["월", "화", "수", "목", "금", "토", "일"].map((w) => (
              <div key={w} style={{ padding: "7px 10px", fontSize: 11, fontWeight: 600, color: "var(--ink3)" }}>
                {w}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))" }}>
            {calDays.map((d, i) => (
              <div
                key={i}
                style={{
                  minHeight: 80,
                  padding: "6px 8px",
                  borderRight: "1px solid var(--line2)",
                  borderBottom: "1px solid var(--line2)",
                  background: d.today ? "var(--accent-soft)" : d.inMonth ? "var(--panel)" : "var(--panel2)",
                }}
              >
                <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11.5, fontWeight: d.today ? 700 : 400, color: d.today ? "var(--accent)" : d.inMonth ? "var(--ink2)" : "var(--ink3)", marginBottom: 5 }}>
                  {d.inMonth ? d.day : ""}
                </div>
                {d.evs.map((e) => {
                  const [bg, fg] = CHIP[e.tag] || CHIP.개인;
                  return (
                    <div key={e.id} style={{ padding: "2px 5px", marginBottom: 3, borderRadius: 4, background: bg, color: fg, fontSize: 10.5, overflow: "hidden", whiteSpace: "nowrap" }}>
                      {e.title}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

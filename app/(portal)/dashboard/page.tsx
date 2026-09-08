import { pageAccess } from "@/lib/guard";
import { Denied } from "@/components/Denied";
import { prisma } from "@/lib/prisma";
import { recentFiles } from "@/lib/files";
import { TodoCheckbox } from "@/components/TodoCheckbox";
import Link from "next/link";

const CHIP: Record<string, [string, string]> = {
  업무: ["var(--accent-soft)", "var(--accent)"],
  반복: ["var(--ok-soft)", "var(--ok)"],
  개인: ["var(--panel3)", "var(--ink2)"],
  마감: ["var(--err-soft)", "var(--err)"],
};
const RUN_DOT: Record<string, string> = { ok: "var(--ok)", running: "var(--accent)", err: "var(--err)" };
const RUN_BG: Record<string, string> = { ok: "var(--ok-soft)", running: "var(--accent-soft)", err: "var(--err-soft)" };
const RUN_FG: Record<string, string> = { ok: "var(--ok)", running: "var(--accent)", err: "var(--err)" };
const RUN_LABEL: Record<string, string> = { ok: "성공", running: "실행중", err: "실패" };
const OP_COLOR: [string, string] = ["var(--accent-soft)", "var(--accent)"];
const PRIORITY_COLOR: Record<number, string> = { 1: "var(--err)", 2: "var(--ink3)", 3: "var(--ink3)" };

export default async function DashboardPage() {
  const { user, level } = await pageAccess("dashboard");
  if (level === 0) return <Denied roleName={user.role.name} />;

  const [todos, incompleteCount, notes, runs, weekRuns, errRuns, files] = await Promise.all([
    prisma.todo.findMany({ where: { parentId: null }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }], take: 5 }),
    prisma.todo.count({ where: { done: false } }),
    prisma.note.findMany({ orderBy: { updatedAt: "desc" }, take: 4 }),
    prisma.scriptRun.findMany({ orderBy: { startedAt: "desc" }, take: 5, include: { script: true } }),
    prisma.scriptRun.count({ where: { startedAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
    prisma.scriptRun.findFirst({ where: { status: "err" }, orderBy: { startedAt: "desc" }, include: { script: true } }),
    recentFiles(4),
  ]);

  const doneCount = todos.filter((t) => t.done).length;

  const kpis = [
    { label: "미완료 할일", value: String(incompleteCount), kind: "err" as const },
    { label: "이번 주 자동 실행", value: String(weekRuns), kind: "ok" as const },
    { label: "최근 실패", value: errRuns ? errRuns.script.file : "없음", kind: "warn" as const },
    { label: "등록된 노트", value: String(notes.length), kind: "dim" as const },
  ];
  const KPI_COLOR = { err: "var(--err)", ok: "var(--ok)", warn: "var(--warn)", dim: "var(--ink3)" };

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px,1fr))", gap: 12, marginBottom: 12 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, padding: "13px 15px" }}>
            <div style={{ fontSize: 11.5, color: "var(--ink3)", marginBottom: 7, whiteSpace: "nowrap" }}>{k.label}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
              <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 20, fontWeight: 600, letterSpacing: "-.03em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {k.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px,1fr))", gap: 12, alignItems: "start" }}>
        <section style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 15px", borderBottom: "1px solid var(--line2)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>오늘의 할일</div>
            <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, color: "var(--ink3)" }}>{doneCount}/{todos.length} 완료</div>
            <Link href="/todos" style={{ marginLeft: "auto", fontSize: 12 }}>
              전체 보기
            </Link>
          </div>
          {todos.length === 0 && <div style={{ padding: "20px 15px", fontSize: 12.5, color: "var(--ink3)" }}>등록된 할일이 없습니다.</div>}
          {todos.map((t) => {
            const [tagBg, tagFg] = CHIP[t.tag || "개인"] || CHIP.개인;
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 15px", borderBottom: "1px solid var(--line2)" }}>
                <TodoCheckbox id={t.id} done={t.done} canWrite={level === 2} />
                {t.priority === 1 && !t.done && (
                  <span title="높은 우선순위" style={{ width: 6, height: 6, borderRadius: "50%", background: PRIORITY_COLOR[1], flex: "none" }} />
                )}
                <div
                  style={{
                    flex: 1,
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
                {t.repeat && <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10.5, color: "var(--ink3)" }}>↻{t.repeat}</span>}
                <span style={{ fontSize: 10.5, fontWeight: 500, padding: "2px 7px", borderRadius: 999, background: tagBg, color: tagFg }}>{t.tag}</span>
              </div>
            );
          })}
        </section>

        <section style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "12px 15px", borderBottom: "1px solid var(--line2)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>자동화 실행 상태</div>
            <Link href="/automation" style={{ marginLeft: "auto", fontSize: 12 }}>
              로그
            </Link>
          </div>
          {runs.length === 0 && <div style={{ padding: "20px 15px", fontSize: 12.5, color: "var(--ink3)" }}>아직 실행 이력이 없습니다.</div>}
          {runs.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 15px", borderBottom: "1px solid var(--line2)" }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  flex: "none",
                  background: RUN_DOT[r.status] || "var(--ink3)",
                  animation: r.status === "running" ? "pulse 1.4s infinite" : "none",
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.script.file}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink3)" }}>{new Date(r.startedAt).toLocaleString("ko-KR")}</div>
              </div>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 500,
                  padding: "2px 7px",
                  borderRadius: 5,
                  background: RUN_BG[r.status] || "var(--panel3)",
                  color: RUN_FG[r.status] || "var(--ink2)",
                }}
              >
                {RUN_LABEL[r.status] || r.status}
              </span>
            </div>
          ))}
        </section>

        <div style={{ display: "grid", gap: 12 }}>
          <section style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", padding: "12px 15px", borderBottom: "1px solid var(--line2)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>최근 노트</div>
              <Link href="/wiki" style={{ marginLeft: "auto", fontSize: 12 }}>
                위키
              </Link>
            </div>
            {notes.length === 0 && <div style={{ padding: "20px 15px", fontSize: 12.5, color: "var(--ink3)" }}>등록된 노트가 없습니다.</div>}
            {notes.map((n) => (
              <div key={n.id} style={{ padding: "9px 15px", borderBottom: "1px solid var(--line2)" }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</div>
                <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 2 }}>
                  {n.folder} · {new Date(n.updatedAt).toLocaleDateString("ko-KR")}
                </div>
              </div>
            ))}
          </section>
          <section style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", padding: "12px 15px", borderBottom: "1px solid var(--line2)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>최근 파일 변경</div>
              <Link href="/files" style={{ marginLeft: "auto", fontSize: 12 }}>
                브라우저
              </Link>
            </div>
            {files.length === 0 && <div style={{ padding: "20px 15px", fontSize: 12.5, color: "var(--ink3)" }}>동기화 폴더가 비어 있습니다.</div>}
            {files.map((f) => {
              const [bg, fg] = OP_COLOR;
              return (
                <div key={f.relPath} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 15px", borderBottom: "1px solid var(--line2)" }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, width: 32, textAlign: "center", padding: "2px 0", borderRadius: 4, background: bg, color: fg, flex: "none" }}>
                    {f.ext || "-"}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono), monospace",
                      fontSize: 11.5,
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: "var(--ink2)",
                    }}
                  >
                    {f.relPath}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--ink3)", flex: "none" }}>{new Date(f.mtime).toLocaleDateString("ko-KR")}</span>
                </div>
              );
            })}
          </section>
        </div>
      </div>
    </>
  );
}

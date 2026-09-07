import { pageAccess } from "@/lib/guard";
import { Denied } from "@/components/Denied";
import { prisma } from "@/lib/prisma";
import { ScriptRunButton } from "@/components/ScriptRunButton";
import { ClearLogsButton } from "@/components/ClearLogsButton";
import Link from "next/link";

const ST_MAP: Record<string, [string, string, string]> = {
  ok: ["성공", "var(--ok-soft)", "var(--ok)"],
  running: ["실행중", "var(--accent-soft)", "var(--accent)"],
  err: ["실패", "var(--err-soft)", "var(--err)"],
  idle: ["대기", "var(--panel3)", "var(--ink2)"],
};

export default async function AutomationPage() {
  const { user, level } = await pageAccess("automation");
  if (level === 0) return <Denied roleName={user.role.name} />;

  const [scripts, runs] = await Promise.all([
    prisma.scriptDef.findMany({
      orderBy: { file: "asc" },
      include: { runs: { orderBy: { startedAt: "desc" }, take: 1 } },
    }),
    prisma.scriptRun.findMany({ orderBy: { startedAt: "desc" }, take: 12, include: { script: true } }),
  ]);

  const canRun = level === 2;
  const canEdit = user.permissions["editor"] > 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px,1fr))", gap: 12, alignItems: "start" }}>
      <section style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 15px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>등록된 스크립트</div>
          <span style={{ fontSize: 11, color: "var(--ink3)", border: "1px solid var(--line)", borderRadius: 5, padding: "1px 7px" }}>화이트리스트 {scripts.length}</span>
          {canEdit && (
            <Link
              href="/editor"
              style={{ marginLeft: "auto", height: 28, padding: "0 11px", border: "1px solid var(--line)", borderRadius: 7, background: "var(--panel2)", color: "var(--ink2)", fontSize: 12, textDecoration: "none", display: "flex", alignItems: "center" }}
            >
              코드 에디터
            </Link>
          )}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) 100px 80px 76px",
            gap: 10,
            padding: "8px 15px",
            background: "var(--panel2)",
            borderBottom: "1px solid var(--line)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: ".04em",
            color: "var(--ink3)",
          }}
        >
          <div>스크립트</div>
          <div>스케줄</div>
          <div>상태</div>
          <div style={{ textAlign: "right" }}>실행</div>
        </div>
        {scripts.map((d) => {
          const status = d.runs[0]?.status || "idle";
          const [label, bg, fg] = ST_MAP[status] || ST_MAP.idle;
          return (
            <div key={d.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 100px 80px 76px", gap: 10, alignItems: "center", padding: "9px 15px", borderBottom: "1px solid var(--line2)" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.file}</span>
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      padding: "1px 5px",
                      borderRadius: 4,
                      background: d.lang === "PY" ? "var(--accent-soft)" : "var(--panel3)",
                      color: d.lang === "PY" ? "var(--accent)" : "var(--ink2)",
                      flex: "none",
                    }}
                  >
                    {d.lang}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--ink3)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.description}</div>
              </div>
              <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11.5, color: "var(--ink2)" }}>{d.cron || "-"}</div>
              <div>
                <span style={{ fontSize: 10.5, fontWeight: 500, padding: "2px 8px", borderRadius: 999, background: bg, color: fg }}>{label}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <ScriptRunButton scriptId={d.id} canRun={canRun} />
              </div>
            </div>
          );
        })}
      </section>

      <section style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", position: "sticky", top: 70 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 15px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>실행 로그</div>
          {canRun && <ClearLogsButton />}
        </div>
        <div style={{ padding: "12px 14px", height: 440, overflow: "auto", background: "var(--panel2)", fontFamily: "var(--font-mono), monospace", fontSize: 11.5, lineHeight: 1.7 }}>
          {runs.length === 0 && <div style={{ color: "var(--ink3)" }}>아직 실행 이력이 없습니다.</div>}
          {runs.map((r) => {
            const [, , fg] = ST_MAP[r.status] || ST_MAP.idle;
            return (
              <div key={r.id} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 9 }}>
                  <span style={{ color: "var(--ink3)", flex: "none" }}>{new Date(r.startedAt).toLocaleTimeString("ko-KR")}</span>
                  <span style={{ color: fg }}>
                    {r.script.file} · {ST_MAP[r.status]?.[0] || r.status}
                    {r.exitCode !== null ? ` · exit ${r.exitCode}` : ""}
                  </span>
                </div>
                {r.log && <div style={{ color: "var(--ink3)", whiteSpace: "pre-wrap", paddingLeft: 12 }}>{r.log.trim()}</div>}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

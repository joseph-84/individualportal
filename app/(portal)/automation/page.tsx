import { pageAccess } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { ClearLogsButton } from "@/components/ClearLogsButton";
import { AutomationClient } from "@/components/AutomationClient";
import Link from "next/link";

const ST_MAP: Record<string, [string, string]> = {
  ok: ["성공", "var(--ok)"],
  running: ["실행중", "var(--accent)"],
  err: ["실패", "var(--err)"],
};

export default async function AutomationPage() {
  const { user, level } = await pageAccess("automation");

  const [scripts, runs] = await Promise.all([
    prisma.scriptDef.findMany({
      orderBy: { file: "asc" },
      include: { runs: { orderBy: { startedAt: "desc" }, take: 1 } },
    }),
    prisma.scriptRun.findMany({ orderBy: { startedAt: "desc" }, take: 20, include: { script: true } }),
  ]);

  const canRun = level === 2;
  const canEdit = true;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px,1fr))", gap: 12, alignItems: "start" }}>
      <div>
        {canEdit && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <Link
              href="/editor"
              style={{ height: 28, padding: "0 11px", border: "1px solid var(--line)", borderRadius: 7, background: "var(--panel2)", color: "var(--ink2)", fontSize: 12, textDecoration: "none", display: "flex", alignItems: "center" }}
            >
              코드 에디터
            </Link>
          </div>
        )}
        <AutomationClient
          canRun={canRun}
          canManage={canRun}
          scripts={scripts.map((d) => ({
            id: d.id,
            file: d.file,
            lang: d.lang,
            description: d.description,
            cron: d.cron,
            enabled: d.enabled,
            status: d.runs[0]?.status || "idle",
          }))}
        />
      </div>

      <section className="automation-log" style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", position: "sticky", top: 70 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 15px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>실행 로그</div>
          {canRun && <ClearLogsButton />}
        </div>
        <div style={{ padding: "12px 14px", height: 440, overflow: "auto", background: "var(--panel2)", fontFamily: "var(--font-mono), monospace", fontSize: 11.5, lineHeight: 1.7 }}>
          {runs.length === 0 && <div style={{ color: "var(--ink3)" }}>아직 실행 이력이 없습니다.</div>}
          {runs.map((r) => {
            const [label, fg] = ST_MAP[r.status] || ["대기", "var(--ink2)"];
            return (
              <div key={r.id} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 9 }}>
                  <span style={{ color: "var(--ink3)", flex: "none" }}>{new Date(r.startedAt).toLocaleTimeString("ko-KR")}</span>
                  <span style={{ color: fg }}>
                    {r.script.file} · {label} · {r.triggeredBy === "cron" ? "스케줄" : "수동"}
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

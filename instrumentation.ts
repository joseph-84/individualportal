export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const g = globalThis as unknown as { __portalSchedulerStarted?: boolean };
  if (g.__portalSchedulerStarted) return;
  g.__portalSchedulerStarted = true;

  const { prisma } = await import("./lib/prisma");
  const { matchesCron } = await import("./lib/cron");
  const { executeScript } = await import("./lib/run-script");

  const firedThisMinute = new Set<string>();
  let lastMinuteKey = "";

  setInterval(async () => {
    const now = new Date();
    const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
    if (minuteKey !== lastMinuteKey) {
      firedThisMinute.clear();
      lastMinuteKey = minuteKey;
    }

    try {
      const scripts = await prisma.scriptDef.findMany({ where: { enabled: true, cron: { not: null } } });
      for (const s of scripts) {
        if (!s.cron || firedThisMinute.has(s.id)) continue;
        if (matchesCron(s.cron, now)) {
          firedThisMinute.add(s.id);
          executeScript(s.id, "cron").catch((err) => {
            console.error(`[scheduler] ${s.file} failed:`, err instanceof Error ? err.message : err);
          });
        }
      }
    } catch (err) {
      console.error("[scheduler] tick failed:", err instanceof Error ? err.message : err);
    }
  }, 30_000);

  console.log("[scheduler] cron scheduler started (30s tick)");
}

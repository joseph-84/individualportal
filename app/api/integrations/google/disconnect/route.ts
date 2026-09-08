import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { disconnectGoogle } from "@/lib/google-calendar";
import { writeAudit } from "@/lib/audit";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  await disconnectGoogle();
  await writeAudit(user, "integration.disconnect", "google_calendar");
  return NextResponse.json({ ok: true });
}

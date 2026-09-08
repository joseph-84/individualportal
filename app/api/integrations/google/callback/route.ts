import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/guard";
import { exchangeGoogleCode } from "@/lib/google-calendar";
import { writeAudit } from "@/lib/audit";
import { GOOGLE_OAUTH_STATE_COOKIE } from "../start/route";

function redirectUri(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host;
  return `${proto}://${host}/api/integrations/google/callback`;
}

export async function GET(req: NextRequest) {
  const user = await requireUser();

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");
  const savedState = req.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;

  const fail = (message: string) => {
    const res = NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(message)}`, req.url));
    res.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    return res;
  };

  if (oauthError) return fail("Google 인증이 취소되었습니다.");
  if (!code || !state || !savedState || state !== savedState) return fail("인증 요청이 유효하지 않습니다. 다시 시도해주세요.");

  try {
    await exchangeGoogleCode(code, redirectUri(req));
    await writeAudit(user, "integration.connect", "google_calendar");
  } catch {
    return fail("Google Calendar 연동에 실패했습니다.");
  }

  const res = NextResponse.redirect(new URL("/settings?connected=google_calendar", req.url));
  res.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
  return res;
}

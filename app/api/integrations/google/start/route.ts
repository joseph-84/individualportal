import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/guard";
import { buildGoogleAuthUrl, GoogleNotConfiguredError } from "@/lib/google-calendar";

export const GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state";

function redirectUri(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host;
  return `${proto}://${host}/api/integrations/google/callback`;
}

export async function GET(req: NextRequest) {
  await requireUser();

  const state = crypto.randomUUID();
  try {
    const url = buildGoogleAuthUrl(redirectUri(req), state);
    const res = NextResponse.redirect(url);
    res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/api/integrations/google" });
    return res;
  } catch (e) {
    if (e instanceof GoogleNotConfiguredError) {
      return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(e.message)}`, req.url));
    }
    throw e;
  }
}

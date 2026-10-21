import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/guard";
import { buildGoogleAuthUrl, GoogleNotConfiguredError } from "@/lib/google-calendar";
import { externalOrigin } from "@/lib/origin";

export const GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state";

export async function GET(req: NextRequest) {
  await requireUser();

  const origin = externalOrigin(req.headers);
  const state = crypto.randomUUID();
  try {
    const url = buildGoogleAuthUrl(`${origin}/api/integrations/google/callback`, state);
    const res = NextResponse.redirect(url);
    res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/api/integrations/google" });
    return res;
  } catch (e) {
    if (e instanceof GoogleNotConfiguredError) {
      return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(e.message)}`, origin));
    }
    throw e;
  }
}

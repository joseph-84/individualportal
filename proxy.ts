import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

const PUBLIC_PATHS = new Set(["/"]);

// Next only sees the plain-HTTP hop between the reverse proxy and this container, so
// req.nextUrl's protocol/host would otherwise always come out as "http://<internal-ip>".
// Redirecting to that instead of the public https:// origin is what caused the redirect
// loop against nginx proxy manager's Force SSL rule. Trust the forwarded headers instead.
function externalOrigin(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  return `${proto}://${host}`;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/_next") || pathname.startsWith("/api/") || pathname.startsWith("/mcp") || pathname.startsWith("/share/")) {
    // API routes and MCP enforce their own auth (Bearer token / apiRequirePerm) and must
    // return JSON, not an HTML redirect. /share/* handles public vs. members-only itself.
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session && !PUBLIC_PATHS.has(pathname)) {
    return NextResponse.redirect(new URL("/", externalOrigin(req)));
  }

  if (session && PUBLIC_PATHS.has(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", externalOrigin(req)));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

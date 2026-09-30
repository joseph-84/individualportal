import { NextResponse, type NextRequest } from "next/server";
import { externalOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

/** RFC 8414 OAuth 2.0 Authorization Server Metadata. Public client only (PKCE, no secret) --
 * this single-user portal is both the authorization server and the resource server it
 * protects, mirroring the "AS=RS" simplification RFC 9728 explicitly allows. */
export async function GET(req: NextRequest) {
  const origin = externalOrigin(req.headers);
  return NextResponse.json({
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["mcp"],
  });
}

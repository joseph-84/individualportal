import { NextResponse, type NextRequest } from "next/server";
import { externalOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

/** RFC 9728 OAuth 2.0 Protected Resource Metadata for the /mcp endpoint -- tells an MCP
 * client which authorization server(s) can mint tokens accepted here. This app is both the
 * resource server (/mcp) and the authorization server (see /.well-known/oauth-authorization-server
 * and /oauth/*), which is a common simplification for a single-tenant server. */
export async function GET(req: NextRequest) {
  const origin = externalOrigin(req.headers);
  return NextResponse.json({
    resource: `${origin}/mcp`,
    authorization_servers: [origin],
  });
}

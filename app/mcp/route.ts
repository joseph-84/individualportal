import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { verifyApiToken } from "@/lib/api-auth";
import { verifyOAuthBearerToken } from "@/lib/oauth";
import { buildMcpServer } from "@/lib/mcp/build-server";
import { externalOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

async function handle(req: Request): Promise<Response> {
  const authHeader = req.headers.get("authorization");
  const origin = externalOrigin(req.headers);
  const resource = `${origin}/mcp`;

  // Two independent auth paths: the original static ApiToken bearer scheme (Claude Code/
  // Desktop configs use this directly) and the newer OAuth access token (claude.ai connector /
  // mobile, via /oauth/*) -- either one is accepted.
  const user = (await verifyApiToken(authHeader)) ?? (await verifyOAuthBearerToken(authHeader, resource));
  if (!user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized. Provide 'Authorization: Bearer <token>' from /account, or connect via OAuth." }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          // RFC 9728: lets an OAuth-aware client discover the authorization server from a 401
          // alone, without already knowing this URL ahead of time.
          "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"`,
        },
      }
    );
  }

  // Stateless: a fresh server+transport per request, scoped to this token's current
  // permissions. No session state to manage, and permission changes take effect immediately.
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = buildMcpServer(user);
  await server.connect(transport);
  return transport.handleRequest(req);
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;

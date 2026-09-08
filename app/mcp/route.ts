import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { verifyApiToken } from "@/lib/api-auth";
import { buildMcpServer } from "@/lib/mcp/build-server";

export const dynamic = "force-dynamic";

async function handle(req: Request): Promise<Response> {
  const user = await verifyApiToken(req.headers.get("authorization"));
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized. Provide 'Authorization: Bearer <token>' from /account." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
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

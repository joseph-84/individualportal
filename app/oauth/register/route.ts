import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function isAllowedRedirectUri(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.hash) return false; // RFC 8252 / MCP spec: no fragment
  if (url.protocol === "https:") return true;
  // Loopback exception for local MCP clients (e.g. a CLI doing its own OAuth dance on localhost).
  return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
}

/** RFC 7591 Dynamic Client Registration -- public clients only (no client_secret; PKCE is
 * mandatory at the authorize step instead). Single-user app, so there's no meaningful "which
 * client may register" policy beyond a sane redirect_uris check; any MCP client (claude.ai,
 * a future desktop app, etc.) can self-register and will still have to go through the login +
 * consent page at /oauth/authorize to get an actual token. */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_client_metadata", error_description: "Request body must be JSON." }, { status: 400 });
  }
  const { redirect_uris, client_name } = (body as Record<string, unknown>) || {};

  if (!Array.isArray(redirect_uris) || redirect_uris.length === 0 || !redirect_uris.every((u) => typeof u === "string")) {
    return NextResponse.json({ error: "invalid_client_metadata", error_description: "redirect_uris must be a non-empty array of strings." }, { status: 400 });
  }
  if (!redirect_uris.every(isAllowedRedirectUri)) {
    return NextResponse.json({ error: "invalid_redirect_uri", error_description: "redirect_uris must be https (or http on localhost), with no fragment." }, { status: 400 });
  }

  const client = await prisma.oAuthClient.create({
    data: {
      clientName: typeof client_name === "string" && client_name.trim() ? client_name.trim() : "MCP client",
      redirectUris: redirect_uris,
    },
  });

  return NextResponse.json(
    {
      client_id: client.id,
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    { status: 201 }
  );
}

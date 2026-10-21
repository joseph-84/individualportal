/** Minimal MCP (Model Context Protocol) client for calling a single tool over Streamable
 * HTTP — just enough to drive this portal's /mcp endpoint from a popup/options page. Reuses
 * the exact request shape verified by hand against the real server earlier in development:
 * a bare "tools/call" JSON-RPC request works without a prior "initialize" handshake, since
 * /mcp is stateless (see app/mcp/route.ts's own comment on this). No MCP SDK needed for one
 * call. */

/** The server can reply as plain JSON or as a single-shot "event: message\ndata: {...}"
 * SSE-formatted body, depending on content negotiation -- handle both. */
function parseRpcResponse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const dataLine = text.split("\n").find((line) => line.startsWith("data:"));
    if (!dataLine) throw new Error(`Unexpected /mcp response format: ${text.slice(0, 200)}`);
    return JSON.parse(dataLine.slice(5).trim());
  }
}

/**
 * @param {string} portalUrl e.g. "https://portal.example.com" (no trailing slash expected, but tolerated)
 * @param {string} token API token from /account ("portal_...")
 * @param {string} name MCP tool name, e.g. "create_favorite"
 * @param {Record<string, unknown>} args tool arguments
 * @returns {Promise<unknown>} the tool's result, JSON-parsed when possible
 */
export async function callMcpTool(portalUrl, token, name, args) {
  const base = portalUrl.replace(/\/+$/, "");
  const res = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`포털에서 ${res.status} 응답을 받았습니다 (토큰이 유효한지 /account에서 확인하세요).`);
  }

  const rpc = parseRpcResponse(bodyText);
  if (rpc.error) {
    throw new Error(rpc.error.message || "MCP 요청이 실패했습니다.");
  }

  const result = rpc.result;
  const text = result?.content?.[0]?.text ?? "";
  if (result?.isError) {
    throw new Error(text || "도구 호출이 실패했습니다.");
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

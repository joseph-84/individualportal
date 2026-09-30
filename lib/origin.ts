/** Next only sees the plain-HTTP hop between the reverse proxy and this container, so
 * relying on the request's own protocol/host gives back the internal http://<container-ip>
 * origin instead of the public https:// one. Trust the forwarded headers instead (same fix
 * as proxy.ts's externalOrigin, extracted here since route handlers, the account page, and
 * the new MCP OAuth endpoints all need the same "what's my public URL" logic). Works with
 * both a route handler's `Request.headers` and a Server Component's awaited `headers()`,
 * since both are plain `Headers` instances. */
export function externalOrigin(h: Headers): string {
  const proto = h.get("x-forwarded-proto") || "http";
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost";
  return `${proto}://${host}`;
}

import { headers } from "next/headers";
import { requireUser } from "@/lib/guard";
import { AccountClient } from "@/components/AccountClient";

export default async function AccountPage() {
  const user = await requireUser();
  const h = await headers();
  const proto = h.get("x-forwarded-proto") || "http";
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost";
  const mcpUrl = `${proto}://${host}/mcp`;

  return <AccountClient name={user.name} email={user.email} mcpUrl={mcpUrl} />;
}

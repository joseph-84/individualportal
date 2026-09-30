"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { authCodeExpiresAt } from "@/lib/oauth";
import { writeAudit } from "@/lib/audit";

function readFields(formData: FormData) {
  return {
    clientId: String(formData.get("client_id") || ""),
    redirectUri: String(formData.get("redirect_uri") || ""),
    codeChallenge: String(formData.get("code_challenge") || ""),
    state: String(formData.get("state") || ""),
    resource: String(formData.get("resource") || ""),
  };
}

/** Re-validates client_id/redirect_uri against the DB rather than trusting the hidden form
 * fields outright -- mirrors the check already done when rendering the consent page
 * (app/oauth/authorize/page.tsx), since a POST to a server action is a fresh request. */
async function validatedClient(clientId: string, redirectUri: string) {
  const client = await prisma.oAuthClient.findUnique({ where: { id: clientId } });
  if (!client || !client.redirectUris.includes(redirectUri)) {
    throw new Error("등록되지 않은 클라이언트이거나 redirect_uri가 일치하지 않습니다.");
  }
  return client;
}

export async function approveAuthorizationAction(formData: FormData) {
  const user = await requireUser();
  const { clientId, redirectUri, codeChallenge, state, resource } = readFields(formData);
  await validatedClient(clientId, redirectUri);

  const authCode = await prisma.oAuthAuthorizationCode.create({
    data: { clientId, redirectUri, codeChallenge, resource, userId: user.id, expiresAt: authCodeExpiresAt() },
  });
  await writeAudit(user, "mcp_oauth.authorize", clientId);

  const url = new URL(redirectUri);
  url.searchParams.set("code", authCode.code);
  if (state) url.searchParams.set("state", state);
  redirect(url.toString());
}

export async function denyAuthorizationAction(formData: FormData) {
  const user = await requireUser();
  const { clientId, redirectUri, state } = readFields(formData);
  await validatedClient(clientId, redirectUri);
  await writeAudit(user, "mcp_oauth.deny", clientId);

  const url = new URL(redirectUri);
  url.searchParams.set("error", "access_denied");
  if (state) url.searchParams.set("state", state);
  redirect(url.toString());
}

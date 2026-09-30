import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { externalOrigin } from "@/lib/origin";
import { approveAuthorizationAction, denyAuthorizationAction } from "@/app/actions/oauth";

interface AuthorizeParams {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  state?: string;
  resource?: string;
}

function errorCard(title: string, message: string) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", color: "var(--ink)", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 28 }}>
        <h1 style={{ fontSize: 16, margin: "0 0 8px" }}>{title}</h1>
        <p style={{ fontSize: 13, color: "var(--ink3)", margin: 0 }}>{message}</p>
      </div>
    </div>
  );
}

export default async function OAuthAuthorizePage({ searchParams }: { searchParams: Promise<AuthorizeParams> }) {
  const params = await searchParams;
  const { response_type, client_id, redirect_uri, code_challenge, code_challenge_method, state, resource } = params;

  if (response_type !== "code" || !client_id || !redirect_uri || !code_challenge) {
    return errorCard("잘못된 요청입니다", "response_type, client_id, redirect_uri, code_challenge가 모두 필요합니다.");
  }
  if (code_challenge_method !== "S256") {
    return errorCard("지원하지 않는 PKCE 방식입니다", "code_challenge_method는 S256만 지원합니다.");
  }

  const client = await prisma.oAuthClient.findUnique({ where: { id: client_id } });
  if (!client || !client.redirectUris.includes(redirect_uri)) {
    return errorCard("등록되지 않은 클라이언트입니다", "client_id 또는 redirect_uri가 등록된 값과 일치하지 않습니다.");
  }

  const user = await getCurrentUser();
  if (!user) {
    const definedParams = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<string, string>;
    const qs = new URLSearchParams(definedParams).toString();
    redirect(`/?next=${encodeURIComponent(`/oauth/authorize?${qs}`)}`);
  }

  const finalResource = resource || `${externalOrigin(await headers())}/mcp`;

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", color: "var(--ink)", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 28 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>{client.clientName}에서 접근을 요청합니다</h1>
        <p style={{ fontSize: 13, color: "var(--ink2)", margin: "0 0 4px" }}>
          <strong>{user.name}</strong> ({user.email}) 계정으로 로그인되어 있습니다.
        </p>
        <p style={{ fontSize: 12.5, color: "var(--ink3)", margin: "0 0 20px" }}>
          허용하면 이 앱이 할일·지식베이스·파일·자동화 등 포털의 모든 기능에 이 계정 권한으로 접근할 수 있습니다(단일 사용자 구조라 별도 권한 범위는 없습니다).
        </p>
        <form style={{ display: "flex", gap: 8 }}>
          <input type="hidden" name="client_id" value={client_id} />
          <input type="hidden" name="redirect_uri" value={redirect_uri} />
          <input type="hidden" name="code_challenge" value={code_challenge} />
          <input type="hidden" name="state" value={state || ""} />
          <input type="hidden" name="resource" value={finalResource} />
          <button
            formAction={approveAuthorizationAction}
            style={{ flex: 1, height: 38, border: 0, borderRadius: 8, background: "var(--accent)", color: "var(--on-accent)", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}
          >
            허용
          </button>
          <button
            formAction={denyAuthorizationAction}
            style={{ flex: 1, height: 38, border: "1px solid var(--line)", borderRadius: 8, background: "var(--panel2)", color: "var(--ink2)", fontSize: 13.5, cursor: "pointer" }}
          >
            거부
          </button>
        </form>
      </div>
    </div>
  );
}

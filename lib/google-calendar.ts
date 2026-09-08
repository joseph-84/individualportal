import "server-only";
import { prisma } from "./prisma";

const PROVIDER = "google_calendar";
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly openid email";

export class GoogleNotConfiguredError extends Error {}

function credentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new GoogleNotConfiguredError("Google Calendar 연동이 설정되어 있지 않습니다. 관리자에게 GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET 설정을 요청하세요.");
  }
  return { clientId, clientSecret };
}

export function buildGoogleAuthUrl(redirectUri: string, state: string): string {
  const { clientId } = credentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<void> {
  const { clientId, clientSecret } = credentials();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google 토큰 교환 실패: ${await res.text()}`);
  const tok: TokenResponse = await res.json();

  let accountEmail: string | null = null;
  try {
    const uiRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${tok.access_token}` } });
    if (uiRes.ok) accountEmail = (await uiRes.json()).email ?? null;
  } catch {
    // non-fatal — the connection still works without a displayed account email
  }

  await prisma.integration.upsert({
    where: { provider: PROVIDER },
    create: {
      provider: PROVIDER,
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token ?? null,
      expiresAt: new Date(Date.now() + tok.expires_in * 1000),
      accountEmail,
    },
    update: {
      accessToken: tok.access_token,
      ...(tok.refresh_token ? { refreshToken: tok.refresh_token } : {}),
      expiresAt: new Date(Date.now() + tok.expires_in * 1000),
      ...(accountEmail ? { accountEmail } : {}),
    },
  });
}

export async function disconnectGoogle(): Promise<void> {
  await prisma.integration.deleteMany({ where: { provider: PROVIDER } });
}

export async function getGoogleIntegrationStatus(): Promise<{ connected: boolean; accountEmail: string | null }> {
  const row = await prisma.integration.findUnique({ where: { provider: PROVIDER } });
  return { connected: !!row, accountEmail: row?.accountEmail ?? null };
}

/** Returns a valid access token, transparently refreshing it via the stored refresh_token
 * if it has expired. Returns null if not connected. */
async function getValidAccessToken(): Promise<string | null> {
  const row = await prisma.integration.findUnique({ where: { provider: PROVIDER } });
  if (!row) return null;
  if (row.expiresAt && row.expiresAt.getTime() > Date.now() + 60_000) return row.accessToken;
  if (!row.refreshToken) return row.accessToken;

  const { clientId, clientSecret } = credentials();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: row.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return row.accessToken;
  const tok: TokenResponse = await res.json();
  await prisma.integration.update({
    where: { provider: PROVIDER },
    data: { accessToken: tok.access_token, expiresAt: new Date(Date.now() + tok.expires_in * 1000) },
  });
  return tok.access_token;
}

export interface GoogleCalendarEvent {
  id: string;
  title: string;
  start: string; // ISO date or date-time
  allDay: boolean;
  htmlLink: string;
}

/** Read-only import: fetches upcoming events from the user's primary Google Calendar.
 * Returns [] if not connected or on any API error (never throws into the calendar view). */
export async function listGoogleEvents(timeMinISO: string, timeMaxISO: string): Promise<GoogleCalendarEvent[]> {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return [];
    const params = new URLSearchParams({
      timeMin: timeMinISO,
      timeMax: timeMaxISO,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = data.items || [];
    return items
      .filter((e) => e.status !== "cancelled" && (e.start?.date || e.start?.dateTime))
      .map((e) => ({
        id: e.id,
        title: e.summary || "(제목 없음)",
        start: e.start.dateTime || e.start.date,
        allDay: !!e.start.date,
        htmlLink: e.htmlLink,
      }));
  } catch {
    return [];
  }
}

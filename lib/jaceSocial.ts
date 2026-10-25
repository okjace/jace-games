import "server-only";

/**
 * Server-side client for Jace Social's Jace Games integration
 * (jace_social/server, /api/v1/integrations/games). Every call sends the
 * player's Jace access token plus the shared app key, so the friends list
 * and invites only work through Jace Games' server, never the browser.
 */

export const JACE_SOCIAL_URL = (process.env.JACE_SOCIAL_URL || "https://jace-social.vercel.app").replace(/\/$/, "");

export type SocialFriend = {
  uuid: string;
  name: string;
  handle: string | null;
  picture: string | null;
  status: "online" | "idle" | "dnd" | "offline";
  activity: string | null;
  jace_sub: string | null;
  jace_username: string | null;
};

export class SocialError extends Error {
  constructor(
    public code: string,
    public status: number,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export function socialConfigured(): boolean {
  return !!process.env.JACE_SOCIAL_APP_KEY;
}

async function call<T>(token: string, path: string, init?: { method: string; body: unknown }): Promise<T> {
  const key = process.env.JACE_SOCIAL_APP_KEY;
  if (!key) throw new SocialError("not_configured", 503);
  let res: Response;
  try {
    res = await fetch(`${JACE_SOCIAL_URL}/api/v1/integrations/games/${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-Jace-App-Key": key,
        ...(init ? { "Content-Type": "application/json" } : {}),
      },
      body: init ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new SocialError("unreachable", 502);
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string; error_description?: string }) | null;
  if (!res.ok || !data) throw new SocialError(data?.error ?? "server_error", res.status, data?.error_description);
  return data;
}

export async function socialFriends(token: string): Promise<{ linked: boolean; friends: SocialFriend[] }> {
  return call(token, "friends");
}

export async function socialInvite(token: string, invite: { to: string; game: string; url: string; code: string }): Promise<void> {
  await call(token, "invite", { method: "POST", body: invite });
}

export async function socialPresence(token: string, activity: string | null): Promise<void> {
  await call(token, "presence", { method: "POST", body: { activity } });
}

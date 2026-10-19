import "server-only";
import type { JaceScore, LeaderboardRow, ScoreSubmission } from "./types";

/**
 * Server-side client for Jace's OAuth API. Nothing here runs in the browser:
 * the client secret and the user's access token never leave the server.
 *
 * The scores endpoints (scores, leaderboard, score import) are a contract
 * Jace hasn't shipped yet. Until it does they answer 404, which surfaces as
 * `JaceUnavailable` and the UI shows "Sync with Jace is coming soon".
 */

export const JACE_URL = (process.env.JACE_URL || "https://jaceo.vercel.app").replace(/\/$/, "");

/** The token is no longer valid; the person must be signed out. */
export class JaceUnauthorized extends Error {}
/** The endpoint doesn't exist yet (or Jace is down). */
export class JaceUnavailable extends Error {}
/** The token lacks the "scores" scope — it was issued before Jace supported it. */
export class JaceNeedsScope extends Error {}

export function clientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.JACE_CLIENT_ID;
  const clientSecret = process.env.JACE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("JACE_CLIENT_ID and JACE_CLIENT_SECRET must be set (see README.md).");
  }
  return { clientId, clientSecret };
}

export function authorizeUrl(opts: { redirectUri: string; state: string }): string {
  const url = new URL(`${JACE_URL}/oauth/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientCredentials().clientId);
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("scope", "profile scores");
  url.searchParams.set("state", opts.state);
  return url.toString();
}

export async function exchangeCode(code: string, redirectUri: string): Promise<string> {
  const { clientId, clientSecret } = clientCredentials();
  const res = await fetch(`${JACE_URL}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as { access_token?: string; error?: string } | null;
  if (!res.ok || !data?.access_token) {
    throw new Error(`Token exchange failed: ${data?.error ?? res.status}`);
  }
  return data.access_token;
}

export type UserInfo = {
  sub: string;
  username: string;
  picture: string | null;
  banned: boolean;
  muted: boolean;
};

async function call(token: string, path: string, init?: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${JACE_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new JaceUnavailable("Couldn't reach Jace.");
  }
  if (res.status === 401) throw new JaceUnauthorized();
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : null;
  if (res.status === 403 && (data as { error?: string } | null)?.error === "insufficient_scope") {
    throw new JaceNeedsScope();
  }
  // 404/405 (route not shipped), an HTML page, or a 5xx: treat as unavailable.
  if (!res.ok || !isJson || data === null) {
    throw new JaceUnavailable(`Jace answered ${res.status} for ${path}.`);
  }
  return data;
}

export async function getUserInfo(token: string): Promise<UserInfo> {
  const data = (await call(token, "/api/oauth/userinfo")) as Partial<UserInfo>;
  if (!data.sub) throw new JaceUnavailable("userinfo had no sub.");
  return {
    sub: String(data.sub),
    username: String(data.username ?? "Jace user"),
    picture: typeof data.picture === "string" ? data.picture : null,
    banned: !!data.banned,
    muted: !!data.muted,
  };
}

export async function getMyScores(token: string, game?: string): Promise<JaceScore[]> {
  const q = game ? `?game=${encodeURIComponent(game)}` : "";
  const data = (await call(token, `/api/oauth/scores${q}`)) as { scores?: JaceScore[] };
  if (!Array.isArray(data.scores)) throw new JaceUnavailable("scores response had no list.");
  return data.scores
    .filter((s) => s && typeof s.game === "string" && typeof s.score === "number")
    .map((s) => ({ id: String(s.id), game: s.game, score: s.score, created_at: String(s.created_at) }));
}

export async function getLeaderboard(
  token: string,
  game: string,
  order: "asc" | "desc",
  limit: number,
): Promise<LeaderboardRow[]> {
  const q = new URLSearchParams({ game, order, limit: String(limit) });
  const data = (await call(token, `/api/oauth/leaderboard?${q}`)) as { scores?: LeaderboardRow[] };
  if (!Array.isArray(data.scores)) throw new JaceUnavailable("leaderboard response had no list.");
  return data.scores.map((r) => ({
    user_id: String(r.user_id),
    username: String(r.username ?? "Jace user"),
    picture: typeof r.picture === "string" ? r.picture : null,
    score: Number(r.score),
    created_at: String(r.created_at),
  }));
}

/** Imports up to 500 scores. external_id makes it idempotent. */
export async function importScores(
  token: string,
  scores: ScoreSubmission[],
): Promise<{ imported: number; skipped: number }> {
  const data = (await call(token, "/api/oauth/scores", {
    method: "POST",
    body: JSON.stringify({
      scores: scores.map((s) => ({
        game: s.game,
        score: s.score,
        created_at: s.created_at,
        external_id: s.external_id,
      })),
    }),
  })) as { imported?: number; skipped?: number };
  return { imported: Number(data.imported ?? 0), skipped: Number(data.skipped ?? 0) };
}

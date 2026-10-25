import "server-only";
import { NextResponse } from "next/server";
import { studioStore, type CommunityGameRow, type GameSummary, type Multiplayer } from "@/lib/db/studio";
import { JaceUnauthorized, getUserInfo } from "@/lib/jace";
import { allow } from "@/lib/rateLimit";
import type { Session } from "@/lib/session";
import { MAX_DESCRIPTION, MAX_GAME_BYTES, MAX_PLAYERS, MAX_REPORT, MAX_SCORE, MAX_TITLE, gameBytes } from "./limits";

/**
 * The Game Studio's rules: who can see, change, publish and take down a
 * game, how big games can be, and how often people can make games, post
 * scores and report. The API routes in app/api/studio are thin wrappers.
 */

export class StudioError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const GAMES_PER_HOUR = 20;
const MAX_GAMES = 100;

/** The Jace account that runs the site and can take games down (SITE_OWNER_JACE_ID). */
export function isSiteOwner(userId: string | null | undefined): boolean {
  const owner = process.env.SITE_OWNER_JACE_ID?.trim();
  return !!owner && !!userId && owner === userId;
}

// ---------- What people can see ----------

/** A published game as anyone may see it; `html` is the published snapshot. */
export type PublicGame = Omit<GameSummary, "removed" | "published"> & { html: string };

export type GameView = {
  game: PublicGame | null;
  /** The owner's working copy. */
  draft: Pick<CommunityGameRow, "html" | "blocks_json" | "published" | "removed" | "updated_at"> | null;
  isOwner: boolean;
  isSiteOwner: boolean;
  removed: boolean;
  reports?: { reason: string; created_at: string }[];
};

function publicGame(row: CommunityGameRow): PublicGame | null {
  if (!row.published || row.published_html === null) return null;
  return {
    id: row.id,
    owner_id: row.owner_id,
    owner_name: row.owner_name,
    title: row.title,
    description: row.description,
    icon: row.icon,
    kind: row.kind,
    multiplayer: row.multiplayer,
    plays: row.plays,
    created_at: row.created_at,
    updated_at: row.updated_at,
    published_at: row.published_at,
    html: row.published_html,
  };
}

export async function viewGame(id: string, session: Session | null): Promise<GameView & { meta: GameSummary }> {
  const row = await studioStore().getGame(id);
  const userId = session?.user.id ?? null;
  const isOwner = !!row && row.owner_id === userId;
  const siteOwner = isSiteOwner(userId);
  if (!row || (!isOwner && !siteOwner && (!row.published || row.removed))) throw new StudioError("That game doesn't exist.", 404);
  const { html: _h, blocks_json: _b, published_html: _p, ...meta } = row;
  void _h;
  void _b;
  void _p;
  return {
    meta,
    game: publicGame(row),
    draft: isOwner ? { html: row.html, blocks_json: row.blocks_json, published: row.published, removed: row.removed, updated_at: row.updated_at } : null,
    isOwner,
    isSiteOwner: siteOwner,
    removed: row.removed,
    ...(siteOwner ? { reports: (await studioStore().reports(id)).map((r) => ({ reason: r.reason, created_at: r.created_at })) } : {}),
  };
}

async function ownGame(id: string, session: Session): Promise<CommunityGameRow> {
  const row = await studioStore().getGame(id);
  if (!row || row.owner_id !== session.user.id) throw new StudioError("That game doesn't exist.", 404);
  return row;
}

// ---------- Checking what the editor sends ----------

export type GameInput = {
  title?: unknown;
  description?: unknown;
  icon?: unknown;
  kind?: unknown;
  html?: unknown;
  blocks_json?: unknown;
  multiplayer?: unknown;
};

function cleanTitle(v: unknown): string {
  const s = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
  if (!s) throw new StudioError("Give your game a name.");
  if (s.length > MAX_TITLE) throw new StudioError(`Names can be at most ${MAX_TITLE} characters.`);
  return s;
}

function cleanDescription(v: unknown): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (s.length > MAX_DESCRIPTION) throw new StudioError(`Descriptions can be at most ${MAX_DESCRIPTION} characters.`);
  return s;
}

function cleanIcon(v: unknown): string {
  const s = typeof v === "string" ? v.trim() : "";
  const segments = [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(s)];
  if (segments.length !== 1 || !/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(s) || s.length > 16) {
    throw new StudioError("The icon must be a single emoji.");
  }
  return s;
}

function cleanMultiplayer(v: unknown): Multiplayer | null {
  if (v === null || v === undefined || v === false) return null;
  const m = v as Partial<Multiplayer>;
  if (typeof m !== "object" || (m.mode !== "race" && m.mode !== "live")) throw new StudioError("Multiplayer mode must be race or live.");
  const min = Number(m.min);
  const max = Number(m.max);
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 2 || max < min || max > MAX_PLAYERS) {
    throw new StudioError(`Players must be between 2 and ${MAX_PLAYERS}, with the minimum no more than the maximum.`);
  }
  return { mode: m.mode, min, max };
}

function cleanCode(html: unknown, blocks: unknown, kind: CommunityGameRow["kind"]): { html: string; blocks_json: unknown } {
  if (typeof html !== "string") throw new StudioError("Send the game's html.");
  const blocks_json = kind === "blocks" ? (blocks ?? null) : null;
  if (blocks_json !== null && (typeof blocks_json !== "object" || Array.isArray(blocks_json))) throw new StudioError("Invalid blocks.");
  if (gameBytes(html, blocks_json) > MAX_GAME_BYTES) throw new StudioError(`Games can be at most ${MAX_GAME_BYTES / 1024} KB.`, 413);
  return { html, blocks_json };
}

// ---------- Changing games ----------

export async function myGames(session: Session): Promise<GameSummary[]> {
  return studioStore().gamesByOwner(session.user.id);
}

export async function publishedGames(): Promise<GameSummary[]> {
  return studioStore().published(200);
}

export async function createGame(session: Session, input: GameInput): Promise<CommunityGameRow> {
  const store = studioStore();
  const kind = input.kind === "blocks" ? "blocks" : input.kind === "code" ? "code" : null;
  if (!kind) throw new StudioError("kind must be code or blocks.");
  const since = new Date(Date.now() - 3_600_000).toISOString();
  if ((await store.countGamesByOwnerSince(session.user.id, since)) >= GAMES_PER_HOUR) {
    throw new StudioError("You've made a lot of games this hour. Try again in a bit.", 429);
  }
  if ((await store.gamesByOwner(session.user.id)).length >= MAX_GAMES) {
    throw new StudioError(`You can have up to ${MAX_GAMES} games. Delete one to make another.`, 409);
  }
  const code = cleanCode(input.html, input.blocks_json, kind);
  const row = await store.createGame({
    owner_id: session.user.id,
    owner_name: session.user.username,
    title: cleanTitle(input.title),
    description: cleanDescription(input.description),
    icon: input.icon === undefined ? "🎮" : cleanIcon(input.icon),
    kind,
    ...code,
    multiplayer: cleanMultiplayer(input.multiplayer),
  });
  await store.addVersion(row.id, row.html, row.blocks_json);
  return row;
}

/** Saves the draft. Changing the code also saves a version you can go back to. */
export async function saveGame(session: Session, id: string, input: GameInput): Promise<CommunityGameRow> {
  const store = studioStore();
  const row = await ownGame(id, session);
  const patch: Partial<CommunityGameRow> = { updated_at: new Date().toISOString(), owner_name: session.user.username };
  if (input.title !== undefined) patch.title = cleanTitle(input.title);
  if (input.description !== undefined) patch.description = cleanDescription(input.description);
  if (input.icon !== undefined) patch.icon = cleanIcon(input.icon);
  if (input.multiplayer !== undefined) patch.multiplayer = cleanMultiplayer(input.multiplayer);
  if (input.kind === "code" && row.kind === "blocks") patch.kind = "code"; // "Convert to code" is one-way
  const kind = patch.kind ?? row.kind;
  let codeChanged = false;
  if (input.html !== undefined) {
    const code = cleanCode(input.html, kind === "blocks" ? input.blocks_json : null, kind);
    codeChanged = code.html !== row.html || JSON.stringify(code.blocks_json) !== JSON.stringify(row.blocks_json);
    Object.assign(patch, code);
  } else if (patch.kind === "code") {
    patch.blocks_json = null;
  }
  const updated = await store.updateGame(id, patch);
  if (!updated) throw new StudioError("That game doesn't exist.", 404);
  if (codeChanged) await store.addVersion(id, updated.html, updated.blocks_json);
  return updated;
}

/**
 * Publishing copies the draft to what players get. Jace is asked again
 * first, so an account banned or muted since signing in can't publish.
 */
export async function setPublished(session: Session, id: string, published: boolean): Promise<CommunityGameRow> {
  const row = await ownGame(id, session);
  if (!published) {
    return (await studioStore().updateGame(id, { published: false }))!;
  }
  if (row.removed) throw new StudioError("This game was taken down by the site owner, so it can't be published.", 403);
  if (!row.html.trim()) throw new StudioError("There's nothing to publish yet.");
  let info;
  try {
    info = await getUserInfo(session.token);
  } catch (e) {
    if (e instanceof JaceUnauthorized) throw new StudioError("Your Jace sign-in expired. Sign in again to publish.", 401);
    throw new StudioError("Couldn't check your Jace account. Try again in a moment.", 503);
  }
  if (info.banned) throw new StudioError("Banned Jace accounts can't publish games.", 403);
  if (info.muted) throw new StudioError("Muted Jace accounts can't publish games right now.", 403);
  const now = new Date().toISOString();
  return (await studioStore().updateGame(id, {
    published: true,
    published_html: row.html,
    published_at: row.published_at && row.published ? row.published_at : now,
    updated_at: now,
    owner_name: info.username || session.user.username,
  }))!;
}

/** Only the site owner (SITE_OWNER_JACE_ID) can take a game down or put it back. */
export async function setRemoved(session: Session, id: string, removed: boolean): Promise<CommunityGameRow> {
  if (!isSiteOwner(session.user.id)) throw new StudioError("Only the site owner can do that.", 403);
  const updated = await studioStore().updateGame(id, { removed });
  if (!updated) throw new StudioError("That game doesn't exist.", 404);
  return updated;
}

export async function deleteGame(session: Session, id: string): Promise<void> {
  await ownGame(id, session);
  await studioStore().deleteGame(id);
}

export async function listVersions(session: Session, id: string) {
  await ownGame(id, session);
  return studioStore().versions(id);
}

export async function getVersion(session: Session, id: string, version: number) {
  await ownGame(id, session);
  const v = Number.isInteger(version) ? await studioStore().version(id, version) : null;
  if (!v) throw new StudioError("That version doesn't exist.", 404);
  return { version: v.version, html: v.html, blocks_json: v.blocks_json, created_at: v.created_at };
}

// ---------- Playing ----------

async function playableGame(id: string): Promise<CommunityGameRow> {
  const row = await studioStore().getGame(id);
  if (!row || !row.published || row.removed) throw new StudioError("That game doesn't exist.", 404);
  return row;
}

/** Counts a play, at most once per person (or address) per game every 30 minutes. */
export async function addPlay(id: string, who: string): Promise<void> {
  await playableGame(id);
  if (!allow(`play:${who}:${id}`, 1, 30 * 60_000)) return;
  await studioStore().addPlay(id);
}

export async function submitScore(session: Session, id: string, score: unknown): Promise<{ best: boolean }> {
  if (typeof score !== "number" || !Number.isFinite(score) || !Number.isInteger(score) || Math.abs(score) > MAX_SCORE) {
    throw new StudioError("Scores must be whole numbers.");
  }
  // A game can report a score every few seconds at most; anything faster is a bug or a script.
  if (!allow(`score:${session.user.id}:${id}`, 10, 60_000) || !allow(`score:${session.user.id}`, 60, 60_000)) {
    throw new StudioError("Too many scores at once. Slow down a little.", 429);
  }
  await playableGame(id);
  const best = await studioStore().submitScore({ game_id: id, user_id: session.user.id, username: session.user.username, score });
  return { best };
}

export async function topScores(id: string) {
  await playableGame(id);
  return (await studioStore().topScores(id, 20)).map((s) => ({ user_id: s.user_id, username: s.username, score: s.score, created_at: s.created_at }));
}

export async function report(session: Session, id: string, reason: unknown): Promise<void> {
  const text = typeof reason === "string" ? reason.trim() : "";
  if (!text) throw new StudioError("Say what's wrong with this game.");
  if (text.length > MAX_REPORT) throw new StudioError(`Reports can be at most ${MAX_REPORT} characters.`);
  if (!allow(`report:${session.user.id}`, 10, 3_600_000)) throw new StudioError("You've sent a lot of reports. Try again later.", 429);
  const row = await playableGame(id);
  if (row.owner_id === session.user.id) throw new StudioError("You can't report your own game.");
  await studioStore().addReport({ game_id: id, reporter_id: session.user.id, reason: text });
}

// ---------- Route helpers ----------

export function studioErrorResponse(e: unknown): NextResponse {
  if (e instanceof StudioError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}

export function signedOut(): NextResponse {
  return NextResponse.json({ error: "Sign in with Jace to use the Game Studio." }, { status: 401 });
}

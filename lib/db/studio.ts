import "server-only";
import { supabase, usingSupabase } from "./rooms";

/**
 * Storage for the Game Studio (supabase/migrations/002_studio.sql): games
 * people make, their saved versions, unverified high scores and reports.
 * Like the rooms store, production uses Supabase with the secret key, and
 * development without Supabase falls back to memory (never in production).
 */

export type Multiplayer = { mode: "race" | "live"; min: number; max: number };

export type CommunityGameRow = {
  id: string;
  owner_id: string;
  owner_name: string;
  title: string;
  description: string;
  icon: string;
  kind: "code" | "blocks";
  html: string;
  blocks_json: unknown;
  published_html: string | null;
  published: boolean;
  removed: boolean;
  multiplayer: Multiplayer | null;
  plays: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

/** A game without its (large) code, for lists. */
export type GameSummary = Omit<CommunityGameRow, "html" | "blocks_json" | "published_html">;

export type VersionRow = { game_id: string; version: number; html: string; blocks_json: unknown; created_at: string };
export type ScoreRow = { game_id: string; user_id: string; username: string; score: number; created_at: string };
export type ReportRow = { id: string; game_id: string; reporter_id: string; reason: string; created_at: string };

export type NewGame = Pick<CommunityGameRow, "owner_id" | "owner_name" | "title" | "description" | "icon" | "kind" | "html" | "blocks_json" | "multiplayer">;

/** Saved versions kept per game; older ones are dropped. */
export const MAX_VERSIONS = 30;

export interface StudioStore {
  createGame(game: NewGame): Promise<CommunityGameRow>;
  getGame(id: string): Promise<CommunityGameRow | null>;
  updateGame(id: string, patch: Partial<CommunityGameRow>): Promise<CommunityGameRow | null>;
  deleteGame(id: string): Promise<void>;
  gamesByOwner(ownerId: string): Promise<GameSummary[]>;
  published(limit: number): Promise<GameSummary[]>;
  countGamesByOwnerSince(ownerId: string, sinceIso: string): Promise<number>;
  addPlay(id: string): Promise<void>;
  addVersion(gameId: string, html: string, blocksJson: unknown): Promise<number>;
  versions(gameId: string): Promise<{ version: number; created_at: string; size: number }[]>;
  version(gameId: string, version: number): Promise<VersionRow | null>;
  /** Keeps the player's best (highest) score. Returns whether this one is their new best. */
  submitScore(row: Omit<ScoreRow, "created_at">): Promise<boolean>;
  topScores(gameId: string, limit: number): Promise<ScoreRow[]>;
  /** False if this person already reported this game. */
  addReport(row: Omit<ReportRow, "id" | "created_at">): Promise<boolean>;
  reports(gameId: string): Promise<ReportRow[]>;
}

const SUMMARY =
  "id, owner_id, owner_name, title, description, icon, kind, published, removed, multiplayer, plays, created_at, updated_at, published_at";

// ---------- Supabase ----------

function check<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

const supabaseStore: StudioStore = {
  async createGame(game) {
    return check(await supabase().from("community_games").insert(game).select().single()) as CommunityGameRow;
  },
  async getGame(id) {
    if (!isUuid(id)) return null;
    return (check(await supabase().from("community_games").select().eq("id", id).maybeSingle()) as CommunityGameRow | null) ?? null;
  },
  async updateGame(id, patch) {
    const rows = check(await supabase().from("community_games").update(patch).eq("id", id).select()) as CommunityGameRow[];
    return rows[0] ?? null;
  },
  async deleteGame(id) {
    check(await supabase().from("community_games").delete().eq("id", id));
  },
  async gamesByOwner(ownerId) {
    return check(await supabase().from("community_games").select(SUMMARY).eq("owner_id", ownerId).order("updated_at", { ascending: false }).limit(200)) as unknown as GameSummary[];
  },
  async published(limit) {
    return check(
      await supabase().from("community_games").select(SUMMARY).eq("published", true).eq("removed", false).order("published_at", { ascending: false }).limit(limit),
    ) as unknown as GameSummary[];
  },
  async countGamesByOwnerSince(ownerId, since) {
    const res = await supabase().from("community_games").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).gte("created_at", since);
    if (res.error) throw new Error(res.error.message);
    return res.count ?? 0;
  },
  async addPlay(id) {
    check(await supabase().rpc("community_add_play", { game: id }));
  },
  async addVersion(gameId, html, blocksJson) {
    const last = check(
      await supabase().from("community_versions").select("version").eq("game_id", gameId).order("version", { ascending: false }).limit(1),
    ) as { version: number }[];
    const version = (last[0]?.version ?? 0) + 1;
    check(await supabase().from("community_versions").insert({ game_id: gameId, version, html, blocks_json: blocksJson }));
    if (version > MAX_VERSIONS) {
      check(await supabase().from("community_versions").delete().eq("game_id", gameId).lte("version", version - MAX_VERSIONS));
    }
    return version;
  },
  async versions(gameId) {
    // Only what the list needs; the size is worked out from the html length.
    const rows = check(
      await supabase().from("community_versions").select("version, created_at, html").eq("game_id", gameId).order("version", { ascending: false }),
    ) as { version: number; created_at: string; html: string }[];
    return rows.map((r) => ({ version: r.version, created_at: r.created_at, size: r.html.length }));
  },
  async version(gameId, version) {
    return (check(await supabase().from("community_versions").select().eq("game_id", gameId).eq("version", version).maybeSingle()) as VersionRow | null) ?? null;
  },
  async submitScore(row) {
    const cur = check(
      await supabase().from("community_scores").select("score").eq("game_id", row.game_id).eq("user_id", row.user_id).maybeSingle(),
    ) as { score: number } | null;
    if (cur && Number(cur.score) >= row.score) return false;
    check(await supabase().from("community_scores").upsert({ ...row, created_at: new Date().toISOString() }));
    return true;
  },
  async topScores(gameId, limit) {
    const rows = check(await supabase().from("community_scores").select().eq("game_id", gameId).order("score", { ascending: false }).order("created_at").limit(limit)) as ScoreRow[];
    return rows.map((r) => ({ ...r, score: Number(r.score) }));
  },
  async addReport(row) {
    const res = await supabase().from("reports").insert(row);
    if (res.error?.code === "23505") return false; // already reported
    check(res);
    return true;
  },
  async reports(gameId) {
    return check(await supabase().from("reports").select().eq("game_id", gameId).order("created_at", { ascending: false })) as ReportRow[];
  },
};

// ---------- In-memory (development only) ----------

type Mem = { games: Map<string, CommunityGameRow>; versions: VersionRow[]; scores: ScoreRow[]; reports: ReportRow[] };
const g = globalThis as unknown as { __jgStudio?: Mem };
const mem = (): Mem => (g.__jgStudio ??= { games: new Map(), versions: [], scores: [], reports: [] });
const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const summary = (r: CommunityGameRow): GameSummary => {
  const { html: _h, blocks_json: _b, published_html: _p, ...rest } = r;
  void _h;
  void _b;
  void _p;
  return clone(rest);
};

const memoryStore: StudioStore = {
  async createGame(game) {
    const now = new Date().toISOString();
    const row: CommunityGameRow = {
      ...clone(game),
      id: crypto.randomUUID(),
      published_html: null,
      published: false,
      removed: false,
      plays: 0,
      created_at: now,
      updated_at: now,
      published_at: null,
    };
    mem().games.set(row.id, row);
    return clone(row);
  },
  async getGame(id) {
    return clone(mem().games.get(id) ?? null);
  },
  async updateGame(id, patch) {
    const r = mem().games.get(id);
    if (!r) return null;
    Object.assign(r, clone(patch));
    return clone(r);
  },
  async deleteGame(id) {
    const m = mem();
    m.games.delete(id);
    m.versions = m.versions.filter((v) => v.game_id !== id);
    m.scores = m.scores.filter((s) => s.game_id !== id);
    m.reports = m.reports.filter((r) => r.game_id !== id);
  },
  async gamesByOwner(ownerId) {
    return [...mem().games.values()].filter((r) => r.owner_id === ownerId).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map(summary);
  },
  async published(limit) {
    return [...mem().games.values()]
      .filter((r) => r.published && !r.removed)
      .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""))
      .slice(0, limit)
      .map(summary);
  },
  async countGamesByOwnerSince(ownerId, since) {
    return [...mem().games.values()].filter((r) => r.owner_id === ownerId && r.created_at >= since).length;
  },
  async addPlay(id) {
    const r = mem().games.get(id);
    if (r) r.plays++;
  },
  async addVersion(gameId, html, blocksJson) {
    const m = mem();
    const mine = m.versions.filter((v) => v.game_id === gameId);
    const version = Math.max(0, ...mine.map((v) => v.version)) + 1;
    m.versions.push({ game_id: gameId, version, html, blocks_json: clone(blocksJson), created_at: new Date().toISOString() });
    m.versions = m.versions.filter((v) => v.game_id !== gameId || v.version > version - MAX_VERSIONS);
    return version;
  },
  async versions(gameId) {
    return mem()
      .versions.filter((v) => v.game_id === gameId)
      .sort((a, b) => b.version - a.version)
      .map((v) => ({ version: v.version, created_at: v.created_at, size: v.html.length }));
  },
  async version(gameId, version) {
    return clone(mem().versions.find((v) => v.game_id === gameId && v.version === version) ?? null);
  },
  async submitScore(row) {
    const m = mem();
    const cur = m.scores.find((s) => s.game_id === row.game_id && s.user_id === row.user_id);
    if (cur && cur.score >= row.score) return false;
    m.scores = m.scores.filter((s) => s !== cur);
    m.scores.push({ ...row, created_at: new Date().toISOString() });
    return true;
  },
  async topScores(gameId, limit) {
    return clone(
      mem()
        .scores.filter((s) => s.game_id === gameId)
        .sort((a, b) => b.score - a.score || a.created_at.localeCompare(b.created_at))
        .slice(0, limit),
    );
  },
  async addReport(row) {
    const m = mem();
    if (m.reports.some((r) => r.game_id === row.game_id && r.reporter_id === row.reporter_id)) return false;
    m.reports.unshift({ ...row, id: crypto.randomUUID(), created_at: new Date().toISOString() });
    return true;
  },
  async reports(gameId) {
    return clone(mem().reports.filter((r) => r.game_id === gameId));
  },
};

export function studioStore(): StudioStore {
  if (usingSupabase()) return supabaseStore;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set in production (see README.md).");
  }
  return memoryStore;
}

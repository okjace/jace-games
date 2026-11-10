import "server-only";
import { supabase, usingSupabase } from "./rooms";
import type { LiveMode, LiveSet, Question, SetSummary } from "@/lib/live/types";

/**
 * Storage for Jace Games Live (supabase/migrations/004_live.sql): Supabase
 * with the secret key in production, an in-memory stand-in in development
 * without Supabase (never in production).
 */

export type LiveGameRow = {
  id: string;
  code: string;
  host_id: string;
  host_name: string;
  set_id: string | null;
  set_title: string | null;
  questions: Question[] | null;
  mode: LiveMode;
  status: "lobby" | "playing" | "ended";
  settings: Record<string, unknown>;
  state: Record<string, unknown>;
  version: number;
  channel: string;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  expires_at: string;
};

export type LivePlayerRow = {
  id: string;
  game_id: string;
  name: string;
  user_id: string | null;
  token_hash: string;
  score: number;
  streak: number;
  correct: number;
  answered: number;
  data: Record<string, unknown>;
  joined_at: string;
  finished_at: string | null;
};

export type NewSet = Pick<LiveSet, "owner_id" | "owner_name" | "title" | "description" | "cover" | "tags" | "visibility" | "questions">;
export type NewGame = Pick<LiveGameRow, "code" | "host_id" | "host_name" | "set_id" | "set_title" | "questions" | "mode" | "settings" | "channel">;

export interface LiveStore {
  createSet(s: NewSet): Promise<LiveSet>;
  getSet(id: string): Promise<LiveSet | null>;
  updateSet(id: string, patch: Partial<LiveSet>): Promise<LiveSet | null>;
  deleteSet(id: string): Promise<void>;
  mySets(owner: string): Promise<SetSummary[]>;
  discover(opts: { q?: string; tag?: string; sort: "popular" | "new"; limit: number; offset: number }): Promise<SetSummary[]>;
  addPlay(id: string): Promise<void>;

  createGame(g: NewGame): Promise<LiveGameRow>;
  gameByCode(code: string): Promise<LiveGameRow | null>;
  updateGame(id: string, patch: Partial<LiveGameRow>, expectVersion?: number): Promise<LiveGameRow | null>;
  countGamesByHostSince(host: string, since: string): Promise<number>;
  deleteExpiredGames(now: string): Promise<number>;

  players(gameId: string): Promise<LivePlayerRow[]>;
  /** Games this Jace account is playing in that haven't ended yet (newest first), with their player in each. */
  activeForUser(userId: string): Promise<{ game: LiveGameRow; player: LivePlayerRow }[]>;
  player(gameId: string, id: string): Promise<LivePlayerRow | null>;
  playerByToken(gameId: string, tokenHash: string): Promise<LivePlayerRow | null>;
  addPlayer(p: Pick<LivePlayerRow, "game_id" | "name" | "user_id" | "token_hash">): Promise<LivePlayerRow | "name_taken">;
  updatePlayer(gameId: string, id: string, patch: Partial<LivePlayerRow>): Promise<LivePlayerRow | null>;
  removePlayer(gameId: string, id: string): Promise<void>;
}

const summary = (s: LiveSet): SetSummary => {
  const { questions, ...rest } = s;
  return { ...rest, questionCount: questions.length };
};

// ---------- Supabase ----------

function check<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const SET_SUMMARY = "id, owner_id, owner_name, title, description, cover, tags, visibility, plays, removed, created_at, updated_at, questions";

function rowToSummary(r: Record<string, unknown>): SetSummary {
  const { questions, ...rest } = r as LiveSet;
  return { ...(rest as Omit<LiveSet, "questions">), questionCount: Array.isArray(questions) ? questions.length : 0 };
}

const supabaseStore: LiveStore = {
  async createSet(s) {
    return check(await supabase().from("live_sets").insert(s).select().single()) as LiveSet;
  },
  async getSet(id) {
    return (check(await supabase().from("live_sets").select().eq("id", id).maybeSingle()) as LiveSet | null) ?? null;
  },
  async updateSet(id, patch) {
    const rows = check(await supabase().from("live_sets").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select()) as LiveSet[];
    return rows[0] ?? null;
  },
  async deleteSet(id) {
    check(await supabase().from("live_sets").delete().eq("id", id));
  },
  async mySets(owner) {
    const rows = check(await supabase().from("live_sets").select(SET_SUMMARY).eq("owner_id", owner).order("updated_at", { ascending: false }).limit(200));
    return (rows as Record<string, unknown>[]).map(rowToSummary);
  },
  async discover({ q, tag, sort, limit, offset }) {
    let query = supabase().from("live_sets").select(SET_SUMMARY).eq("visibility", "public").eq("removed", false);
    if (q) {
      const like = `%${q.replace(/[%_\\,()]/g, " ").trim()}%`;
      query = query.or(`title.ilike.${like},description.ilike.${like},owner_name.ilike.${like}`);
    }
    if (tag) query = query.contains("tags", [tag]);
    query = sort === "new" ? query.order("created_at", { ascending: false }) : query.order("plays", { ascending: false }).order("updated_at", { ascending: false });
    const rows = check(await query.range(offset, offset + limit - 1));
    return (rows as Record<string, unknown>[]).map(rowToSummary);
  },
  async addPlay(id) {
    await supabase().rpc("live_set_add_play", { set_id: id });
  },
  async createGame(g) {
    return check(await supabase().from("live_games").insert(g).select().single()) as LiveGameRow;
  },
  async gameByCode(code) {
    return (check(await supabase().from("live_games").select().eq("code", code).maybeSingle()) as LiveGameRow | null) ?? null;
  },
  async updateGame(id, patch, expectVersion) {
    let q = supabase().from("live_games").update(patch).eq("id", id);
    if (expectVersion !== undefined) q = q.eq("version", expectVersion);
    const rows = check(await q.select()) as LiveGameRow[];
    return rows[0] ?? null;
  },
  async countGamesByHostSince(host, since) {
    const res = await supabase().from("live_games").select("id", { count: "exact", head: true }).eq("host_id", host).gte("created_at", since);
    if (res.error) throw new Error(res.error.message);
    return res.count ?? 0;
  },
  async deleteExpiredGames(now) {
    const rows = check(await supabase().from("live_games").delete().lt("expires_at", now).select("id")) as { id: string }[];
    return rows.length;
  },
  async players(gameId) {
    return check(await supabase().from("live_players").select().eq("game_id", gameId).order("joined_at")) as LivePlayerRow[];
  },
  async activeForUser(userId) {
    const mine = check(await supabase().from("live_players").select().eq("user_id", userId).order("joined_at", { ascending: false }).limit(20)) as LivePlayerRow[];
    if (mine.length === 0) return [];
    const games = check(
      await supabase()
        .from("live_games")
        .select()
        .in("id", [...new Set(mine.map((p) => p.game_id))])
        .neq("status", "ended")
        .gt("expires_at", new Date().toISOString()),
    ) as LiveGameRow[];
    return mine.flatMap((player) => {
      const game = games.find((gm) => gm.id === player.game_id);
      return game ? [{ game, player }] : [];
    });
  },
  async player(gameId, id) {
    return (check(await supabase().from("live_players").select().eq("game_id", gameId).eq("id", id).maybeSingle()) as LivePlayerRow | null) ?? null;
  },
  async playerByToken(gameId, tokenHash) {
    return (check(await supabase().from("live_players").select().eq("game_id", gameId).eq("token_hash", tokenHash).maybeSingle()) as LivePlayerRow | null) ?? null;
  },
  async addPlayer(p) {
    const res = await supabase().from("live_players").insert(p).select().single();
    if (res.error?.code === "23505") return "name_taken";
    return check(res) as LivePlayerRow;
  },
  async updatePlayer(gameId, id, patch) {
    const rows = check(await supabase().from("live_players").update(patch).eq("game_id", gameId).eq("id", id).select()) as LivePlayerRow[];
    return rows[0] ?? null;
  },
  async removePlayer(gameId, id) {
    check(await supabase().from("live_players").delete().eq("game_id", gameId).eq("id", id));
  },
};

// ---------- In-memory (development only) ----------

type Mem = { sets: Map<string, LiveSet>; games: Map<string, LiveGameRow>; players: Map<string, LivePlayerRow[]> };
const g = globalThis as unknown as { __jgLive?: Mem };
const mem = (): Mem => (g.__jgLive ??= { sets: new Map(), games: new Map(), players: new Map() });
const clone = <T,>(v: T): T => (v === undefined || v === null ? v : JSON.parse(JSON.stringify(v)));

const memoryStore: LiveStore = {
  async createSet(s) {
    const now = new Date().toISOString();
    const row: LiveSet = { ...clone(s), id: crypto.randomUUID(), plays: 0, removed: false, created_at: now, updated_at: now };
    mem().sets.set(row.id, row);
    return clone(row);
  },
  async getSet(id) {
    return clone(mem().sets.get(id) ?? null);
  },
  async updateSet(id, patch) {
    const s = mem().sets.get(id);
    if (!s) return null;
    Object.assign(s, clone(patch), { updated_at: new Date().toISOString() });
    return clone(s);
  },
  async deleteSet(id) {
    mem().sets.delete(id);
  },
  async mySets(owner) {
    return [...mem().sets.values()].filter((s) => s.owner_id === owner).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map((s) => clone(summary(s)));
  },
  async discover({ q, tag, sort, limit, offset }) {
    const needle = q?.toLowerCase().trim();
    return [...mem().sets.values()]
      .filter((s) => s.visibility === "public" && !s.removed)
      .filter((s) => !needle || `${s.title} ${s.description} ${s.owner_name}`.toLowerCase().includes(needle))
      .filter((s) => !tag || s.tags.includes(tag))
      .sort((a, b) => (sort === "new" ? b.created_at.localeCompare(a.created_at) : b.plays - a.plays))
      .slice(offset, offset + limit)
      .map((s) => clone(summary(s)));
  },
  async addPlay(id) {
    const s = mem().sets.get(id);
    if (s) s.plays++;
  },
  async createGame(gm) {
    if ([...mem().games.values()].some((x) => x.code === gm.code)) throw new Error("duplicate code");
    const now = new Date();
    const row: LiveGameRow = {
      ...clone(gm),
      id: crypto.randomUUID(),
      status: "lobby",
      state: {},
      version: 0,
      created_at: now.toISOString(),
      started_at: null,
      ended_at: null,
      expires_at: new Date(now.getTime() + 12 * 3_600_000).toISOString(),
    };
    mem().games.set(row.id, row);
    mem().players.set(row.id, []);
    return clone(row);
  },
  async gameByCode(code) {
    return clone([...mem().games.values()].find((x) => x.code === code) ?? null);
  },
  async updateGame(id, patch, expectVersion) {
    const r = mem().games.get(id);
    if (!r || (expectVersion !== undefined && r.version !== expectVersion)) return null;
    Object.assign(r, clone(patch));
    return clone(r);
  },
  async countGamesByHostSince(host, since) {
    return [...mem().games.values()].filter((x) => x.host_id === host && x.created_at >= since).length;
  },
  async deleteExpiredGames(now) {
    let n = 0;
    for (const [id, r] of mem().games) {
      if (r.expires_at >= now) continue;
      mem().games.delete(id);
      mem().players.delete(id);
      n++;
    }
    return n;
  },
  async players(gameId) {
    return clone(mem().players.get(gameId) ?? []);
  },
  async activeForUser(userId) {
    const now = new Date().toISOString();
    const out: { game: LiveGameRow; player: LivePlayerRow }[] = [];
    for (const [gameId, list] of mem().players) {
      const game = mem().games.get(gameId);
      if (!game || game.status === "ended" || game.expires_at < now) continue;
      for (const player of list) if (player.user_id === userId) out.push(clone({ game, player }));
    }
    return out.sort((a, b) => b.player.joined_at.localeCompare(a.player.joined_at)).slice(0, 20);
  },
  async player(gameId, id) {
    return clone(mem().players.get(gameId)?.find((p) => p.id === id) ?? null);
  },
  async playerByToken(gameId, tokenHash) {
    return clone(mem().players.get(gameId)?.find((p) => p.token_hash === tokenHash) ?? null);
  },
  async addPlayer(p) {
    const list = mem().players.get(p.game_id) ?? [];
    if (list.some((x) => x.name.toLowerCase() === p.name.toLowerCase())) return "name_taken";
    const row: LivePlayerRow = { ...p, id: crypto.randomUUID(), score: 0, streak: 0, correct: 0, answered: 0, data: {}, joined_at: new Date().toISOString(), finished_at: null };
    list.push(row);
    mem().players.set(p.game_id, list);
    return clone(row);
  },
  async updatePlayer(gameId, id, patch) {
    const p = mem().players.get(gameId)?.find((x) => x.id === id);
    if (!p) return null;
    Object.assign(p, clone(patch));
    return clone(p);
  },
  async removePlayer(gameId, id) {
    mem().players.set(gameId, (mem().players.get(gameId) ?? []).filter((p) => p.id !== id));
  },
};

export function liveStore(): LiveStore {
  if (usingSupabase()) return supabaseStore;
  if (process.env.NODE_ENV === "production") throw new Error("Supabase must be configured in production (see README.md).");
  return memoryStore;
}

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Storage for multiplayer rooms (supabase/migrations/001_multiplayer.sql).
 * Production uses Supabase with the secret key. In development without
 * Supabase configured, an in-memory store stands in so the whole flow can
 * be tried locally; it's never used in production.
 */

export type RoomRow = {
  id: string;
  code: string;
  game: string;
  mode: "race" | "turns" | "live";
  host: string;
  status: "lobby" | "playing" | "done";
  seed: number;
  state: unknown;
  version: number;
  channel: string;
  min_players: number;
  max_players: number;
  settings: Record<string, unknown>;
  deadline: string | null;
  outcome: unknown;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  expires_at: string;
};

export type PlayerRow = {
  room_id: string;
  user_id: string;
  username: string;
  picture: string | null;
  seat: number;
  ready: boolean;
  left_at: string | null;
  result: unknown;
  joined_at: string;
};

export type MatchResultRow = {
  room_id: string;
  game: string;
  user_id: string;
  username: string;
  placement: number;
  players: number;
  won: boolean;
};

export type NewRoom = Omit<RoomRow, "id" | "created_at" | "started_at" | "ended_at" | "expires_at" | "outcome" | "deadline" | "state" | "version" | "status"> &
  Partial<Pick<RoomRow, "state">>;

export interface RoomStore {
  createRoom(room: NewRoom): Promise<RoomRow>;
  roomByCode(code: string): Promise<RoomRow | null>;
  /** Applies `patch`; with `expectVersion`, only if the room is still at that version. Returns the new row or null. */
  updateRoom(id: string, patch: Partial<RoomRow>, expectVersion?: number): Promise<RoomRow | null>;
  deleteRoom(id: string): Promise<void>;
  players(roomId: string): Promise<PlayerRow[]>;
  addPlayer(p: Omit<PlayerRow, "joined_at" | "left_at" | "result" | "ready">): Promise<void>;
  updatePlayer(roomId: string, userId: string, patch: Partial<PlayerRow>): Promise<void>;
  updatePlayers(roomId: string, patch: Partial<PlayerRow>): Promise<void>;
  removePlayer(roomId: string, userId: string): Promise<void>;
  countRoomsByHostSince(host: string, sinceIso: string): Promise<number>;
  addResults(rows: MatchResultRow[]): Promise<void>;
  winsLeaderboard(game: string, limit: number): Promise<{ user_id: string; username: string; wins: number; played: number }[]>;
  userRecord(userId: string): Promise<{ game: string; wins: number; played: number }[]>;
  deleteExpired(nowIso: string): Promise<number>;
}

// ---------- Supabase ----------

function supabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL?.trim().replace(/\/(rest|realtime|auth)\/v1.*$/, "").replace(/\/+$/, "") || undefined;
}

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!client) {
    const url = supabaseUrl();
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set (see README.md).");
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const supabaseStore: RoomStore = {
  async createRoom(room) {
    return check(await supabase().from("rooms").insert(room).select().single()) as RoomRow;
  },
  async roomByCode(code) {
    return (check(await supabase().from("rooms").select().eq("code", code).maybeSingle()) as RoomRow | null) ?? null;
  },
  async updateRoom(id, patch, expectVersion) {
    let q = supabase().from("rooms").update(patch).eq("id", id);
    if (expectVersion !== undefined) q = q.eq("version", expectVersion);
    const rows = check(await q.select()) as RoomRow[];
    return rows[0] ?? null;
  },
  async deleteRoom(id) {
    check(await supabase().from("rooms").delete().eq("id", id));
  },
  async players(roomId) {
    return check(await supabase().from("room_players").select().eq("room_id", roomId).order("seat")) as PlayerRow[];
  },
  async addPlayer(p) {
    check(await supabase().from("room_players").insert(p));
  },
  async updatePlayer(roomId, userId, patch) {
    check(await supabase().from("room_players").update(patch).eq("room_id", roomId).eq("user_id", userId));
  },
  async updatePlayers(roomId, patch) {
    check(await supabase().from("room_players").update(patch).eq("room_id", roomId));
  },
  async removePlayer(roomId, userId) {
    check(await supabase().from("room_players").delete().eq("room_id", roomId).eq("user_id", userId));
  },
  async countRoomsByHostSince(host, since) {
    const res = await supabase().from("rooms").select("id", { count: "exact", head: true }).eq("host", host).gte("created_at", since);
    if (res.error) throw new Error(res.error.message);
    return res.count ?? 0;
  },
  async addResults(rows) {
    if (rows.length) check(await supabase().from("match_results").insert(rows));
  },
  async winsLeaderboard(game, limit) {
    const rows = check(
      await supabase().from("match_results").select("user_id, username, won, created_at").eq("game", game).order("created_at", { ascending: false }).limit(5000),
    ) as { user_id: string; username: string; won: boolean }[];
    return tallyWins(rows).slice(0, limit);
  },
  async userRecord(userId) {
    const rows = check(await supabase().from("match_results").select("game, won").eq("user_id", userId).limit(5000)) as {
      game: string;
      won: boolean;
    }[];
    return tallyByGame(rows);
  },
  async deleteExpired(now) {
    const rows = check(await supabase().from("rooms").delete().lt("expires_at", now).select("id")) as { id: string }[];
    return rows.length;
  },
};

function tallyWins(rows: { user_id: string; username: string; won: boolean }[]) {
  const by = new Map<string, { user_id: string; username: string; wins: number; played: number }>();
  for (const r of rows) {
    // Rows are newest first, so the first username seen is the current one.
    const e = by.get(r.user_id) ?? { user_id: r.user_id, username: r.username, wins: 0, played: 0 };
    e.played++;
    if (r.won) e.wins++;
    by.set(r.user_id, e);
  }
  return [...by.values()].filter((e) => e.wins > 0).sort((a, b) => b.wins - a.wins || a.played - b.played);
}

function tallyByGame(rows: { game: string; won: boolean }[]) {
  const by = new Map<string, { game: string; wins: number; played: number }>();
  for (const r of rows) {
    const e = by.get(r.game) ?? { game: r.game, wins: 0, played: 0 };
    e.played++;
    if (r.won) e.wins++;
    by.set(r.game, e);
  }
  return [...by.values()];
}

// ---------- In-memory (development only) ----------

type Mem = { rooms: Map<string, RoomRow>; players: Map<string, PlayerRow[]>; results: (MatchResultRow & { created_at: string })[] };
const g = globalThis as unknown as { __jgMem?: Mem };
const mem = (): Mem => (g.__jgMem ??= { rooms: new Map(), players: new Map(), results: [] });
const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

const memoryStore: RoomStore = {
  async createRoom(room) {
    if ([...mem().rooms.values()].some((r) => r.code === room.code)) throw new Error("duplicate code");
    const now = new Date();
    const row: RoomRow = {
      state: null,
      ...room,
      id: crypto.randomUUID(),
      status: "lobby",
      version: 0,
      deadline: null,
      outcome: null,
      created_at: now.toISOString(),
      started_at: null,
      ended_at: null,
      expires_at: new Date(now.getTime() + 86_400_000).toISOString(),
    };
    mem().rooms.set(row.id, row);
    mem().players.set(row.id, []);
    return clone(row);
  },
  async roomByCode(code) {
    return clone([...mem().rooms.values()].find((r) => r.code === code) ?? null);
  },
  async updateRoom(id, patch, expectVersion) {
    const r = mem().rooms.get(id);
    if (!r || (expectVersion !== undefined && r.version !== expectVersion)) return null;
    Object.assign(r, clone(patch));
    return clone(r);
  },
  async deleteRoom(id) {
    mem().rooms.delete(id);
    mem().players.delete(id);
  },
  async players(roomId) {
    return clone([...(mem().players.get(roomId) ?? [])].sort((a, b) => a.seat - b.seat));
  },
  async addPlayer(p) {
    const list = mem().players.get(p.room_id) ?? [];
    if (list.some((x) => x.user_id === p.user_id)) throw new Error("duplicate player");
    list.push({ ...p, ready: false, left_at: null, result: null, joined_at: new Date().toISOString() });
    mem().players.set(p.room_id, list);
  },
  async updatePlayer(roomId, userId, patch) {
    const p = mem().players.get(roomId)?.find((x) => x.user_id === userId);
    if (p) Object.assign(p, clone(patch));
  },
  async updatePlayers(roomId, patch) {
    for (const p of mem().players.get(roomId) ?? []) Object.assign(p, clone(patch));
  },
  async removePlayer(roomId, userId) {
    mem().players.set(roomId, (mem().players.get(roomId) ?? []).filter((p) => p.user_id !== userId));
  },
  async countRoomsByHostSince(host, since) {
    return [...mem().rooms.values()].filter((r) => r.host === host && r.created_at >= since).length;
  },
  async addResults(rows) {
    const now = new Date().toISOString();
    mem().results.unshift(...rows.map((r) => ({ ...r, created_at: now })));
  },
  async winsLeaderboard(game, limit) {
    return tallyWins(mem().results.filter((r) => r.game === game)).slice(0, limit);
  },
  async userRecord(userId) {
    return tallyByGame(mem().results.filter((r) => r.user_id === userId));
  },
  async deleteExpired(now) {
    let n = 0;
    for (const [id, r] of mem().rooms) {
      if (r.expires_at >= now) continue;
      mem().rooms.delete(id);
      mem().players.delete(id);
      n++;
    }
    return n;
  },
};

export function usingSupabase(): boolean {
  return !!(supabaseUrl() && process.env.SUPABASE_SECRET_KEY);
}

export function roomStore(): RoomStore {
  if (usingSupabase()) return supabaseStore;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set in production (see README.md).");
  }
  return memoryStore;
}

import "server-only";
import { EMPTY_STATS, type CustomFrame, type LiveStats } from "@/lib/live/locker";
import { supabase, usingSupabase } from "./rooms";

/** Lockers (supabase/migrations/009_live_locker.sql); in memory during development without Supabase. */

export type LockerRow = {
  user_id: string;
  xp: number;
  icon: string;
  frame: string;
  title?: string;
  custom_frame?: CustomFrame | null;
  fx?: string;
  name_color?: string;
  effect?: string;
  badge?: string;
  stats?: Partial<LiveStats> | null;
  granted_badges?: string[] | null;
  username?: string | null;
  last_daily?: string | null;
};

/** What someone picked in their locker, as stored. */
export type Look = { icon: string; frame: string; title: string; custom_frame: CustomFrame | null; fx: string; name_color: string; effect: string; badge: string };

/** A stored row as avatar choices (to check with cleanAvatar). */
export const lookOf = (r: LockerRow) => ({
  icon: r.icon,
  frame: r.frame,
  custom: r.custom_frame ?? undefined,
  fx: r.fx,
  title: r.title,
  nameColor: r.name_color,
  effect: r.effect,
  badge: r.badge,
});
export const statsOf = (r: LockerRow): LiveStats => ({ ...EMPTY_STATS, ...(r.stats ?? {}) });
/** Badges the site owner gave this person. */
export const grantedOf = (r: LockerRow): string[] => (Array.isArray(r.granted_badges) ? r.granted_badges.filter((b) => typeof b === "string") : []);

export interface LockerStore {
  get(userId: string): Promise<LockerRow>;
  setLook(userId: string, look: Look): Promise<void>;
  /** Site owner: the badges given to this person by hand. */
  setGranted(userId: string, badges: string[]): Promise<void>;
  /** After a game: adds it to their stats (for badges). */
  addStats(userId: string, change: (s: LiveStats) => LiveStats): Promise<void>;
  addXp(userId: string, amount: number): Promise<void>;
  /** Keeps the username on file (so the site owner can find people). */
  touch(userId: string, username: string): Promise<void>;
  /** Site owner: people whose username matches (or everyone, newest XP first). */
  search(q: string, limit: number): Promise<LockerRow[]>;
  /** The first game someone finishes each day (UTC) earns a bonus. True if this is it (and marks the day as claimed). */
  claimDaily(userId: string): Promise<boolean>;
  /** Site owner: sets someone's XP exactly. */
  setXp(userId: string, xp: number, username?: string | null): Promise<void>;
}

const blank = (user_id: string): LockerRow => ({ user_id, xp: 0, icon: "smile", frame: "none" });

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const supabaseStore: LockerStore = {
  async get(userId) {
    const row = check(await supabase().from("live_lockers").select("user_id, xp, icon, frame, title, custom_frame, fx, name_color, effect, badge, stats, granted_badges").eq("user_id", userId).maybeSingle()) as LockerRow | null;
    return row ?? blank(userId);
  },
  async setLook(userId, look) {
    check(await supabase().from("live_lockers").upsert({ user_id: userId, ...look, updated_at: new Date().toISOString() }, { onConflict: "user_id" }));
  },
  async setGranted(userId, badges) {
    check(await supabase().from("live_lockers").upsert({ user_id: userId, granted_badges: badges }, { onConflict: "user_id" }));
  },
  async addStats(userId, change) {
    const row = (check(await supabase().from("live_lockers").select("stats").eq("user_id", userId).maybeSingle()) as { stats: Partial<LiveStats> | null } | null) ?? null;
    const next = change({ ...EMPTY_STATS, ...(row?.stats ?? {}) });
    check(await supabase().from("live_lockers").upsert({ user_id: userId, stats: next }, { onConflict: "user_id" }));
  },
  async addXp(userId, amount) {
    check(await supabase().rpc("live_locker_add_xp", { uid: userId, amount }));
  },
  async touch(userId, username) {
    // Only write when it changed, so page loads don't rewrite the row every time.
    const row = check(await supabase().from("live_lockers").select("username").eq("user_id", userId).maybeSingle()) as { username: string | null } | null;
    if (row?.username === username) return;
    check(await supabase().from("live_lockers").upsert({ user_id: userId, username }, { onConflict: "user_id" }));
  },
  async search(q, limit) {
    let query = supabase().from("live_lockers").select("user_id, xp, icon, frame, username, stats, granted_badges").order("xp", { ascending: false }).limit(limit);
    const term = q.trim().replace(/[%_\\]/g, "");
    if (term) query = query.ilike("username", `%${term}%`);
    return check(await query) as LockerRow[];
  },
  async claimDaily(userId) {
    const today = new Date().toISOString().slice(0, 10);
    // Only one update can move last_daily to today, so two games ending at once can't both claim it.
    const res = await supabase().from("live_lockers").update({ last_daily: today }).eq("user_id", userId).or(`last_daily.is.null,last_daily.lt.${today}`).select("user_id");
    if (res.error) throw new Error(res.error.message);
    if ((res.data?.length ?? 0) > 0) return true;
    // No locker row yet: make one already marked for today.
    const ins = await supabase().from("live_lockers").insert({ user_id: userId, last_daily: today }).select("user_id");
    return !ins.error && (ins.data?.length ?? 0) > 0;
  },
  async setXp(userId, xp, username) {
    check(await supabase().from("live_lockers").upsert({ user_id: userId, xp, ...(username ? { username } : {}), updated_at: new Date().toISOString() }, { onConflict: "user_id" }));
  },
};

const g = globalThis as unknown as { __jgLockers?: Map<string, LockerRow> };
const mem = () => (g.__jgLockers ??= new Map());

const memoryStore: LockerStore = {
  async get(userId) {
    return { ...(mem().get(userId) ?? blank(userId)) };
  },
  async setLook(userId, look) {
    mem().set(userId, { ...(mem().get(userId) ?? blank(userId)), ...look });
  },
  async setGranted(userId, badges) {
    mem().set(userId, { ...(mem().get(userId) ?? blank(userId)), granted_badges: badges });
  },
  async addStats(userId, change) {
    const row = mem().get(userId) ?? blank(userId);
    mem().set(userId, { ...row, stats: change(statsOf(row)) });
  },
  async addXp(userId, amount) {
    const row = mem().get(userId) ?? blank(userId);
    mem().set(userId, { ...row, xp: row.xp + amount });
  },
  async touch(userId, username) {
    mem().set(userId, { ...(mem().get(userId) ?? blank(userId)), username });
  },
  async search(q, limit) {
    const term = q.trim().toLowerCase();
    return [...mem().values()]
      .filter((r) => !term || (r.username ?? "").toLowerCase().includes(term))
      .sort((a, b) => b.xp - a.xp)
      .slice(0, limit)
      .map((r) => ({ ...r }));
  },
  async claimDaily(userId) {
    const today = new Date().toISOString().slice(0, 10);
    const row = mem().get(userId) ?? blank(userId);
    if (row.last_daily === today) return false;
    mem().set(userId, { ...row, last_daily: today });
    return true;
  },
  async setXp(userId, xp, username) {
    mem().set(userId, { ...(mem().get(userId) ?? blank(userId)), xp, ...(username ? { username } : {}) });
  },
};

export function lockerStore(): LockerStore {
  if (usingSupabase()) return supabaseStore;
  if (process.env.NODE_ENV === "production") throw new Error("Supabase must be configured in production.");
  return memoryStore;
}

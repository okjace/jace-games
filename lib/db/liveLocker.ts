import "server-only";
import { supabase, usingSupabase } from "./rooms";

/** Lockers (supabase/migrations/009_live_locker.sql); in memory during development without Supabase. */

export type LockerRow = { user_id: string; xp: number; icon: string; frame: string };

export interface LockerStore {
  get(userId: string): Promise<LockerRow>;
  setLook(userId: string, look: { icon: string; frame: string }): Promise<void>;
  addXp(userId: string, amount: number): Promise<void>;
}

const blank = (user_id: string): LockerRow => ({ user_id, xp: 0, icon: "smile", frame: "none" });

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const supabaseStore: LockerStore = {
  async get(userId) {
    const row = check(await supabase().from("live_lockers").select("user_id, xp, icon, frame").eq("user_id", userId).maybeSingle()) as LockerRow | null;
    return row ?? blank(userId);
  },
  async setLook(userId, look) {
    check(await supabase().from("live_lockers").upsert({ user_id: userId, ...look, updated_at: new Date().toISOString() }, { onConflict: "user_id" }));
  },
  async addXp(userId, amount) {
    check(await supabase().rpc("live_locker_add_xp", { uid: userId, amount }));
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
  async addXp(userId, amount) {
    const row = mem().get(userId) ?? blank(userId);
    mem().set(userId, { ...row, xp: row.xp + amount });
  },
};

export function lockerStore(): LockerStore {
  if (usingSupabase()) return supabaseStore;
  if (process.env.NODE_ENV === "production") throw new Error("Supabase must be configured in production.");
  return memoryStore;
}

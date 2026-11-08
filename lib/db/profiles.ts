import "server-only";
import { supabase, usingSupabase } from "./rooms";

/** Profiles (supabase/migrations/012_profiles.sql) and keeping old usernames up to date. In memory during development without Supabase. */

export interface ProfileStore {
  displayName(userId: string): Promise<string>;
  setDisplayName(userId: string, name: string): Promise<void>;
  /** After a Jace username change: puts the new name on everything this person made. Returns how many things changed. */
  rename(userId: string, username: string): Promise<number>;
}

/** Tables that keep a copy of the maker's username. */
const OWNED: { table: string; id: string; name: string }[] = [
  { table: "live_sets", id: "owner_id", name: "owner_name" },
  { table: "live_maps", id: "owner_id", name: "owner_name" },
  { table: "community_games", id: "owner_id", name: "owner_name" },
  { table: "community_scores", id: "user_id", name: "username" },
];

const supabaseStore: ProfileStore = {
  async displayName(userId) {
    const res = await supabase().from("profiles").select("display_name").eq("user_id", userId).maybeSingle();
    if (res.error) throw new Error(res.error.message);
    return (res.data?.display_name as string | undefined) ?? "";
  },
  async setDisplayName(userId, name) {
    const res = await supabase().from("profiles").upsert({ user_id: userId, display_name: name, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (res.error) throw new Error(res.error.message);
  },
  async rename(userId, username) {
    let n = 0;
    for (const o of OWNED) {
      const res = await supabase().from(o.table).update({ [o.name]: username }).eq(o.id, userId).neq(o.name, username).select(o.id);
      if (!res.error) n += res.data?.length ?? 0;
    }
    return n;
  },
};

const g = globalThis as unknown as { __jgProfiles?: Map<string, string> };
const mem = () => (g.__jgProfiles ??= new Map());

const memoryStore: ProfileStore = {
  async displayName(userId) {
    return mem().get(userId) ?? "";
  },
  async setDisplayName(userId, name) {
    mem().set(userId, name);
  },
  async rename() {
    return 0;
  },
};

export function profileStore(): ProfileStore {
  if (usingSupabase()) return supabaseStore;
  if (process.env.NODE_ENV === "production") throw new Error("Supabase must be configured in production.");
  return memoryStore;
}

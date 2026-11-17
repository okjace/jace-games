import "server-only";
import { supabase, usingSupabase } from "./rooms";

/** Each person's own settings (supabase/migrations/024_user_prefs.sql); in memory during development without Supabase. */

export type Prefs = {
  theme?: string;
  modes?: string[];
  effectsOff?: boolean;
  /** No chat / no voice calls in any game. */
  noChat?: boolean;
  noCalls?: boolean;
  /** Light, dark or auto. */
  look?: "light" | "dark" | "auto";
  /** Theme market themes they installed. */
  installed?: string[];
  /** Public profile: shown at /u/<username> and on Find profiles. */
  publicProfile?: boolean;
  bio?: string;
  /** Kept with a public profile so it can be found by name. */
  username?: string;
  displayName?: string;
};

const mem = globalThis as unknown as { __jlPrefs?: Map<string, Prefs> };
const memory = () => (mem.__jlPrefs ??= new Map());

export async function getPrefs(userId: string): Promise<Prefs | null> {
  if (!usingSupabase()) return memory().get(userId) ?? null;
  const res = await supabase().from("user_prefs").select("prefs").eq("user_id", userId).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return ((res.data as { prefs: Prefs } | null)?.prefs ?? null) as Prefs | null;
}

export async function savePrefs(userId: string, prefs: Prefs): Promise<void> {
  if (!usingSupabase()) {
    if (process.env.NODE_ENV === "production") throw new Error("Supabase must be configured in production.");
    memory().set(userId, prefs);
    return;
  }
  const res = await supabase().from("user_prefs").upsert({ user_id: userId, prefs, updated_at: new Date().toISOString() });
  if (res.error) throw new Error(res.error.message);
}

/** Public profiles whose name matches (or everyone's, most recent first). */
export async function publicProfiles(q: string, limit = 60): Promise<{ user_id: string; prefs: Prefs }[]> {
  const needle = q.trim().toLowerCase();
  if (!usingSupabase()) {
    return [...memory().entries()]
      .filter(([, p]) => p.publicProfile && (!needle || `${p.username} ${p.displayName}`.toLowerCase().includes(needle)))
      .slice(0, limit)
      .map(([user_id, prefs]) => ({ user_id, prefs }));
  }
  let query = supabase().from("user_prefs").select("user_id, prefs").eq("prefs->>publicProfile", "true");
  if (needle) query = query.or(`prefs->>username.ilike.%${needle.replace(/[%_,()]/g, "")}%,prefs->>displayName.ilike.%${needle.replace(/[%_,()]/g, "")}%`);
  const res = await query.order("updated_at", { ascending: false }).limit(limit);
  if (res.error) throw new Error(res.error.message);
  return res.data as { user_id: string; prefs: Prefs }[];
}

/** A public profile by username (null if there isn't one, or it's private). */
export async function publicProfileByName(username: string): Promise<{ user_id: string; prefs: Prefs } | null> {
  const name = username.trim().toLowerCase();
  if (!usingSupabase()) {
    const hit = [...memory().entries()].find(([, p]) => p.publicProfile && p.username?.toLowerCase() === name);
    return hit ? { user_id: hit[0], prefs: hit[1] } : null;
  }
  const res = await supabase().from("user_prefs").select("user_id, prefs").eq("prefs->>publicProfile", "true").ilike("prefs->>username", name.replace(/[%_]/g, "")).limit(1);
  if (res.error) throw new Error(res.error.message);
  return (res.data?.[0] as { user_id: string; prefs: Prefs } | undefined) ?? null;
}

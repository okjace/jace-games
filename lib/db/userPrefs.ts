import "server-only";
import { supabase, usingSupabase } from "./rooms";

/** Each person's own settings (supabase/migrations/024_user_prefs.sql); in memory during development without Supabase. */

export type Prefs = { theme?: string; modes?: string[]; effectsOff?: boolean };

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

import "server-only";
import { supabase, usingSupabase } from "./rooms";

/** Weekly challenge scores (supabase/migrations/031_weekly_challenge.sql); in memory during development without Supabase. */

export type WeeklyRow = { week: string; user_id: string; mode: string; best: number; username: string; avatar: unknown; claimed: boolean; updated_at: string };

const mem = globalThis as unknown as { __jlWeekly?: Map<string, WeeklyRow> };
const memory = () => (mem.__jlWeekly ??= new Map());

/** Keeps a player's best for the week. */
export async function submitWeekly(row: Omit<WeeklyRow, "claimed" | "updated_at">): Promise<void> {
  const updated_at = new Date().toISOString();
  if (!usingSupabase()) {
    const key = `${row.week}:${row.user_id}`;
    const cur = memory().get(key);
    if (!cur || cur.best < row.best) memory().set(key, { ...row, claimed: cur?.claimed ?? false, updated_at });
    return;
  }
  const got = await supabase().from("live_weekly_scores").select("best").eq("week", row.week).eq("user_id", row.user_id).maybeSingle();
  if (got.error) throw new Error(got.error.message);
  const prev = (got.data as { best: number } | null)?.best;
  if (prev !== undefined && prev >= row.best) return;
  const res = await supabase().from("live_weekly_scores").upsert({ ...row, updated_at });
  if (res.error) throw new Error(res.error.message);
}

export async function weeklyTop(week: string, limit = 50): Promise<WeeklyRow[]> {
  if (!usingSupabase()) return [...memory().values()].filter((r) => r.week === week).sort((a, b) => b.best - a.best || a.updated_at.localeCompare(b.updated_at)).slice(0, limit);
  const res = await supabase().from("live_weekly_scores").select().eq("week", week).order("best", { ascending: false }).order("updated_at", { ascending: true }).limit(limit);
  if (res.error) throw new Error(res.error.message);
  return res.data as WeeklyRow[];
}

/** Marks a prize as claimed; true only for the one call that did it (so it can't be claimed twice). */
export async function markClaimed(week: string, userId: string): Promise<boolean> {
  if (!usingSupabase()) {
    const r = memory().get(`${week}:${userId}`);
    if (!r || r.claimed) return false;
    r.claimed = true;
    return true;
  }
  const res = await supabase().from("live_weekly_scores").update({ claimed: true }).eq("week", week).eq("user_id", userId).eq("claimed", false).select("user_id");
  if (res.error) throw new Error(res.error.message);
  return (res.data?.length ?? 0) > 0;
}

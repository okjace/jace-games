import "server-only";
import { supabase, usingSupabase } from "./rooms";

/** Global leaderboards for Live modes (supabase/migrations/023_live_mode_scores.sql); in memory during development without Supabase. */

export type BoardRow = { user_id: string; mode: string; best: number; username: string; avatar: unknown; game_code: string | null; updated_at: string };

const mem = globalThis as unknown as { __jlBoards?: Map<string, BoardRow> };
const memory = () => (mem.__jlBoards ??= new Map());

/** Saves a score if it beats the player's best for that mode. Returns whether it's their new best. */
export async function submitBest(row: Omit<BoardRow, "updated_at">): Promise<{ best: boolean; previous: number | null }> {
  const updated_at = new Date().toISOString();
  if (!usingSupabase()) {
    if (process.env.NODE_ENV === "production") throw new Error("Supabase must be configured in production.");
    const key = `${row.user_id}:${row.mode}`;
    const cur = memory().get(key);
    if (cur && cur.best >= row.best) return { best: false, previous: cur.best };
    memory().set(key, { ...row, updated_at });
    return { best: true, previous: cur?.best ?? null };
  }
  const got = await supabase().from("live_mode_scores").select("best").eq("user_id", row.user_id).eq("mode", row.mode).maybeSingle();
  if (got.error) throw new Error(got.error.message);
  const previous = (got.data as { best: number } | null)?.best ?? null;
  if (previous !== null && previous >= row.best) return { best: false, previous };
  const res = await supabase().from("live_mode_scores").upsert({ ...row, updated_at });
  if (res.error) throw new Error(res.error.message);
  return { best: true, previous };
}

export async function topScores(mode: string, limit = 50): Promise<BoardRow[]> {
  if (!usingSupabase()) return [...memory().values()].filter((r) => r.mode === mode).sort((a, b) => b.best - a.best).slice(0, limit);
  const res = await supabase().from("live_mode_scores").select().eq("mode", mode).order("best", { ascending: false }).limit(limit);
  if (res.error) throw new Error(res.error.message);
  return res.data as BoardRow[];
}

/** Someone's bests in every mode (for their public profile). */
export async function bestsFor(userId: string): Promise<BoardRow[]> {
  if (!usingSupabase()) return [...memory().values()].filter((r) => r.user_id === userId).sort((a, b) => b.best - a.best);
  const res = await supabase().from("live_mode_scores").select().eq("user_id", userId).order("best", { ascending: false }).limit(40);
  if (res.error) throw new Error(res.error.message);
  return res.data as BoardRow[];
}

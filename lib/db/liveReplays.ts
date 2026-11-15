import "server-only";
import type { ReplayData } from "@/lib/live/replay";
import { REPLAY_DAYS } from "@/lib/live/replay";
import { supabase, usingSupabase } from "./rooms";

/** Saved game replays (supabase/migrations/029_live_replays.sql); in memory during development without Supabase. */

export type ReplayRow = { id: string; code: string; host_id: string; mode: string; data: ReplayData; created_at: string; expires_at: string };

const mem = globalThis as unknown as { __jlReplays?: Map<string, ReplayRow> };
const memory = () => (mem.__jlReplays ??= new Map());

export async function saveReplay(row: Omit<ReplayRow, "id" | "created_at" | "expires_at">): Promise<string> {
  const expires_at = new Date(Date.now() + REPLAY_DAYS * 86_400_000).toISOString();
  if (!usingSupabase()) {
    if (process.env.NODE_ENV === "production") throw new Error("Supabase must be configured in production.");
    const id = crypto.randomUUID();
    memory().set(id, { ...row, id, created_at: new Date().toISOString(), expires_at });
    return id;
  }
  const res = await supabase().from("live_replays").insert({ ...row, expires_at }).select("id").single();
  if (res.error) throw new Error(res.error.message);
  return (res.data as { id: string }).id;
}

export async function getReplay(id: string): Promise<ReplayRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  if (!usingSupabase()) {
    const r = memory().get(id);
    return r && r.expires_at > new Date().toISOString() ? r : null;
  }
  const res = await supabase().from("live_replays").select().eq("id", id).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return (res.data as ReplayRow | null) ?? null;
}

// ---------- Players' own screens ----------

/** One moment of a player's screen: when (server ms) and the view they had. */
export type PovFrame = { at: number; v: Record<string, unknown> };
const povMem = globalThis as unknown as { __jlPovs?: Map<string, PovFrame[]> };
const povs = () => (povMem.__jlPovs ??= new Map());

export async function savePov(replayId: string, playerId: string, frames: PovFrame[]): Promise<void> {
  if (!usingSupabase()) {
    povs().set(`${replayId}:${playerId}`, frames);
    return;
  }
  const res = await supabase().from("live_replay_povs").upsert({ replay_id: replayId, player_id: playerId, frames });
  if (res.error) throw new Error(res.error.message);
}

export async function getPov(replayId: string, playerId: string): Promise<PovFrame[] | null> {
  if (!usingSupabase()) return povs().get(`${replayId}:${playerId}`) ?? null;
  const res = await supabase().from("live_replay_povs").select("frames").eq("replay_id", replayId).eq("player_id", playerId).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return ((res.data as { frames: PovFrame[] } | null)?.frames as PovFrame[]) ?? null;
}

/** Which players' screens a replay has. */
export async function povPlayers(replayId: string): Promise<string[]> {
  if (!usingSupabase()) return [...povs().keys()].filter((k) => k.startsWith(`${replayId}:`)).map((k) => k.slice(replayId.length + 1));
  const res = await supabase().from("live_replay_povs").select("player_id").eq("replay_id", replayId);
  if (res.error) return [];
  return (res.data as { player_id: string }[]).map((r) => r.player_id);
}

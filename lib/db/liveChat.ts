import "server-only";
import { supabase, usingSupabase } from "./rooms";

/** Chat messages in Live games (supabase/migrations/019_live_chat.sql); in memory during development without Supabase. */

export type ChatRow = { id: string; game_id: string; player_id: string | null; name: string; host: boolean; text: string; created_at: string };

export interface ChatStore {
  add(m: Omit<ChatRow, "id" | "created_at">): Promise<ChatRow>;
  /** The latest messages (oldest first), optionally only after a time. */
  list(gameId: string, after?: string, limit?: number): Promise<ChatRow[]>;
  remove(gameId: string, id: string): Promise<void>;
}

const supabaseStore: ChatStore = {
  async add(m) {
    const res = await supabase().from("live_chat").insert(m).select().single();
    if (res.error) throw new Error(res.error.message);
    return res.data as ChatRow;
  },
  async list(gameId, after, limit = 60) {
    let q = supabase().from("live_chat").select().eq("game_id", gameId).order("created_at", { ascending: false }).limit(limit);
    if (after) q = q.gt("created_at", after);
    const res = await q;
    if (res.error) throw new Error(res.error.message);
    return (res.data as ChatRow[]).reverse();
  },
  async remove(gameId, id) {
    const res = await supabase().from("live_chat").delete().eq("game_id", gameId).eq("id", id);
    if (res.error) throw new Error(res.error.message);
  },
};

const g = globalThis as unknown as { __jgChat?: ChatRow[] };
const mem = () => (g.__jgChat ??= []);

const memoryStore: ChatStore = {
  async add(m) {
    const row = { ...m, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    mem().push(row);
    return { ...row };
  },
  async list(gameId, after, limit = 60) {
    return mem()
      .filter((m) => m.game_id === gameId && (!after || m.created_at > after))
      .slice(-limit)
      .map((m) => ({ ...m }));
  },
  async remove(gameId, id) {
    g.__jgChat = mem().filter((m) => !(m.game_id === gameId && m.id === id));
  },
};

export function chatStore(): ChatStore {
  if (usingSupabase()) return supabaseStore;
  if (process.env.NODE_ENV === "production") throw new Error("Supabase must be configured in production.");
  return memoryStore;
}

import "server-only";
import { usingSupabase } from "@/lib/db/rooms";
import { devBus } from "./devBus";

/**
 * Sends a live event to everyone on a room's channel, the same way Jace
 * Social notifies players: Supabase Realtime's broadcast REST endpoint with
 * the secret key. Events only say what changed; clients then fetch through
 * the API, so nothing private travels over the channel.
 */
export async function broadcast(topic: string, event: string, payload: Record<string, unknown>): Promise<void> {
  if (!usingSupabase()) {
    devBus().publish(topic, event, payload);
    return;
  }
  const url = process.env.SUPABASE_URL!.trim().replace(/\/(rest|realtime|auth)\/v1.*$/, "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SECRET_KEY!;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ messages: [{ topic, event, payload, private: false }] }),
    });
  } catch (e) {
    console.error("realtime broadcast failed", e); // best effort; clients also poll
  }
}

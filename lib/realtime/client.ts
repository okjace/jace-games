"use client";

import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";

/**
 * A room's live channel in the browser: Supabase Realtime broadcast and
 * presence in production, or the development relay (app/api/dev/realtime)
 * when Supabase isn't configured. Players send each other fast, unimportant
 * things here (race progress, live game frames, drawing strokes); anything
 * that matters goes through /api/rooms and the server.
 */

export type PresenceMember = { key: string; meta: { userId: string; username: string } };

export type RoomChannel = {
  send: (event: string, payload: unknown) => void;
  on: (event: string, fn: (payload: unknown) => void) => () => void;
  onPresence: (fn: (members: PresenceMember[]) => void) => () => void;
  close: () => void;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let sb: SupabaseClient | null = null;
function supabase(): SupabaseClient {
  return (sb ??= createClient(SUPABASE_URL!, SUPABASE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } }));
}

export function openRoomChannel(topic: string, me: { userId: string; username: string } | null): RoomChannel {
  const handlers = new Map<string, Set<(p: unknown) => void>>();
  const presenceHandlers = new Set<(m: PresenceMember[]) => void>();
  const emit = (event: string, payload: unknown) => handlers.get(event)?.forEach((fn) => fn(payload));
  const on = (event: string, fn: (p: unknown) => void) => {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event)!.add(fn);
    return () => void handlers.get(event)?.delete(fn);
  };
  const onPresence = (fn: (m: PresenceMember[]) => void) => {
    presenceHandlers.add(fn);
    return () => void presenceHandlers.delete(fn);
  };

  if (SUPABASE_URL && SUPABASE_KEY) {
    const channel: RealtimeChannel = supabase().channel(topic, {
      config: { broadcast: { self: false }, presence: { key: me?.userId ?? `spectator-${Math.random().toString(36).slice(2)}` } },
    });
    channel.on("broadcast", { event: "*" }, (msg) => emit(msg.event, msg.payload));
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<{ userId: string; username: string }>();
      const list = Object.entries(state).map(([key, metas]) => ({ key, meta: metas[0] as unknown as PresenceMember["meta"] }));
      presenceHandlers.forEach((fn) => fn(list));
    });
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED" && me) void channel.track(me);
    });
    return {
      send: (event, payload) => void channel.send({ type: "broadcast", event, payload }),
      on,
      onPresence,
      close: () => void supabase().removeChannel(channel),
    };
  }

  // Development relay.
  const q = new URLSearchParams({ topic });
  if (me) {
    q.set("key", me.userId);
    q.set("meta", JSON.stringify(me));
  }
  const source = new EventSource(`/api/dev/realtime?${q}`);
  const myKey = me?.userId;
  source.onmessage = (e) => {
    const msg = JSON.parse(e.data) as { event: string; payload: unknown };
    if (msg.event === "__presence") presenceHandlers.forEach((fn) => fn(msg.payload as PresenceMember[]));
    else if ((msg.payload as { __from?: string } | null)?.__from !== myKey || !myKey) emit(msg.event, unwrap(msg.payload));
  };
  return {
    send: (event, payload) =>
      void fetch("/api/dev/realtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, event, payload: { __from: myKey, __p: payload } }),
      }),
    on,
    onPresence,
    close: () => source.close(),
  };
}

function unwrap(p: unknown): unknown {
  return p && typeof p === "object" && "__p" in p ? (p as { __p: unknown }).__p : p;
}

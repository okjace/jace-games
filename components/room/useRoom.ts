"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { openRoomChannel, type PresenceMember, type RoomChannel } from "@/lib/realtime/client";
import type { RoomPayload } from "@/lib/rooms";

/** The room as the server sent it, plus how far the server's clock is from ours (ms). */
export type RoomData = RoomPayload & { clockSkew: number };
export type { RoomData as RoomPayload };

/**
 * Loads a room and keeps it fresh: re-fetches whenever the server
 * broadcasts a change on the room's channel, and every few seconds as a
 * fallback. Exposes the channel so games can talk to each other directly.
 */
export function useRoom(code: string, me: { userId: string; username: string } | null) {
  const [data, setData] = useState<RoomData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [channel, setChannel] = useState<RoomChannel | null>(null);
  const [online, setOnline] = useState<PresenceMember[]>([]);
  const versionRef = useRef(-1);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${code}`, { cache: "no-store" });
      const body = await res.json();
      if (res.status === 404) {
        setGone(true);
        return;
      }
      if (!res.ok) throw new Error(body.error ?? "Couldn't load the room.");
      versionRef.current = body.room.version;
      setData({ ...body, clockSkew: body.serverNow - Date.now() });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the room.");
    }
  }, [code]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const t = setInterval(() => document.visibilityState === "visible" && void refresh(), 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const topic = data?.topic ?? null;
  const meKey = me ? `${me.userId}|${me.username}` : "";
  useEffect(() => {
    if (!topic) return;
    const [userId, username] = meKey ? meKey.split("|") : [];
    const ch = openRoomChannel(topic, userId ? { userId, username } : null);
    const offRoom = ch.on("room", (p) => {
      if ((p as { deleted?: boolean })?.deleted) setGone(true);
      else void refresh();
    });
    const offPresence = ch.onPresence(setOnline);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChannel(ch);
    return () => {
      offRoom();
      offPresence();
      ch.close();
      setChannel(null);
    };
  }, [topic, meKey, refresh]);

  /** Sends an action to the server; the response is the updated room. */
  const act = useCallback(
    async (action: string, extra: Record<string, unknown> = {}): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch(`/api/rooms/${code}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...extra }),
        });
        const body = await res.json();
        if (!res.ok) {
          if (res.status === 409) void refresh();
          return { ok: false, error: body.error ?? "That didn't work." };
        }
        if (body?.room) {
          versionRef.current = body.room.version;
          setData({ ...body, clockSkew: body.serverNow - Date.now() });
        } else void refresh();
        return { ok: true };
      } catch {
        return { ok: false, error: "You're offline." };
      }
    },
    [code, refresh],
  );

  return { data, error, gone, channel, online, act, refresh };
}

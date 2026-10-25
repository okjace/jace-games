"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SDK_LIMITS, buildSrcdoc, type SandboxInit, type SandboxPlayer } from "@/lib/studio/sandbox";

/**
 * Runs a community game in a sandboxed iframe (see lib/studio/sandbox.ts).
 * The sandbox is allow-scripts and allow-pointer-lock only: never
 * allow-same-origin (the game would get this site's cookies and storage)
 * and never allow-top-navigation. Messages are only accepted from this
 * frame's own window, and every one is checked: scores must be numbers,
 * room messages need a short event name and small JSON data, and both are
 * rate-limited.
 */

/** How a game talks to the other players. Rooms back it with the room channel; the editor with a local link. */
export type RoomLink = {
  mode: "race" | "live";
  isHost: boolean;
  mySeat: number;
  players: SandboxPlayer[];
  send: (event: string, data: unknown) => void;
  /** Calls `fn` for every message from another player; returns an unsubscribe. */
  subscribe: (fn: (from: number, event: string, data: unknown) => void) => () => void;
};

export type LogEntry = { level: "log" | "info" | "warn" | "error"; text: string };

type Props = {
  html: string;
  playerName: string;
  seed?: number;
  room?: RoomLink | null;
  onScore?: (score: number) => void;
  onGameOver?: (winners: number[] | null) => void;
  onLog?: (entry: LogEntry) => void;
  /** Bump to restart the game. */
  runKey?: number | string;
  title: string;
  className?: string;
  autoFocus?: boolean;
};

export function GameFrame({ html, playerName, seed = 1, room = null, onScore, onGameOver, onLog, runKey = 0, title, className = "", autoFocus = false }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [left, setLeft] = useState<string | null>(null);
  const loads = useRef(0);

  // Keep the latest callbacks without rebuilding the game when they change.
  const cb = useRef({ onScore, onGameOver, onLog, room });
  useEffect(() => {
    cb.current = { onScore, onGameOver, onLog, room };
  });

  // The game only restarts when what it was told at the start changes.
  const roomKey = room ? JSON.stringify({ mode: room.mode, isHost: room.isHost, mySeat: room.mySeat, players: room.players }) : "";
  const srcdoc = useMemo(() => {
    const init: SandboxInit = { player: { name: playerName }, seed, room: roomKey ? JSON.parse(roomKey) : null };
    return buildSrcdoc(html, init);
  }, [html, playerName, seed, roomKey]);

  const frameKey = useMemo(() => `${runKey}:${hash(srcdoc)}`, [runKey, srcdoc]);

  useEffect(() => {
    loads.current = 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLeft(null);
  }, [frameKey]);

  // Messages from the game.
  useEffect(() => {
    let sendTimes: number[] = [];
    let logTimes: number[] = [];
    let lastScoreAt = 0;
    const within = (times: number[], max: number) => {
      const now = Date.now();
      const recent = times.filter((t) => now - t < 1000);
      if (recent.length >= max) return { ok: false, recent };
      recent.push(now);
      return { ok: true, recent };
    };
    const onMessage = (e: MessageEvent) => {
      const win = frameRef.current?.contentWindow;
      if (!win || e.source !== win) return; // only our own game
      const m = e.data as Record<string, unknown> | null;
      if (!m || typeof m !== "object" || m.__jace !== 1 || typeof m.type !== "string") return;
      const { onScore, onGameOver, onLog, room } = cb.current;
      switch (m.type) {
        case "score": {
          if (typeof m.score !== "number" || !Number.isFinite(m.score)) return;
          const now = Date.now();
          if (now - lastScoreAt < 1000) return; // at most one a second
          lastScoreAt = now;
          onScore?.(Math.max(-1e9, Math.min(1e9, Math.round(m.score))));
          return;
        }
        case "gameOver": {
          const winners = Array.isArray(m.winners) ? m.winners.filter((s): s is number => Number.isInteger(s)).slice(0, 8) : null;
          onGameOver?.(winners);
          return;
        }
        case "send": {
          if (!room || typeof m.event !== "string" || !SDK_LIMITS.eventPattern.test(m.event)) return;
          let json: string;
          try {
            json = JSON.stringify(m.data ?? null);
          } catch {
            return;
          }
          if (json.length > SDK_LIMITS.maxDataBytes) {
            onLog?.({ level: "warn", text: `jace.room.send("${m.event}"): data is over ${SDK_LIMITS.maxDataBytes / 1024} KB, not sent.` });
            return;
          }
          const r = within(sendTimes, SDK_LIMITS.messagesPerSecond);
          sendTimes = r.recent;
          if (!r.ok) return;
          room.send(m.event, JSON.parse(json));
          return;
        }
        case "log": {
          if (!onLog || typeof m.text !== "string") return;
          const r = within(logTimes, SDK_LIMITS.logsPerSecond);
          logTimes = r.recent;
          if (!r.ok) return;
          const level = m.level === "warn" || m.level === "error" || m.level === "info" ? m.level : "log";
          onLog({ level, text: m.text.slice(0, 500) });
          return;
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Messages from the other players, passed into the game.
  useEffect(() => {
    if (!room) return;
    return room.subscribe((from, event, data) => {
      if (!SDK_LIMITS.eventPattern.test(event)) return;
      frameRef.current?.contentWindow?.postMessage({ __jace: 1, type: "msg", event, data, from }, "*");
    });
  }, [room]);

  return (
    <div className={`relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-black ${className}`}>
      {left ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-white/80">
          <p className="text-3xl">🚧</p>
          <p>{left}</p>
        </div>
      ) : (
        <iframe
          key={frameKey}
          ref={frameRef}
          title={title}
          srcDoc={srcdoc}
          sandbox="allow-scripts allow-pointer-lock"
          referrerPolicy="no-referrer"
          allow="fullscreen 'none'; camera 'none'; microphone 'none'; geolocation 'none'"
          className="touch-game absolute inset-0 h-full w-full border-0"
          onLoad={() => {
            loads.current++;
            // A game that navigates its frame somewhere else loses its CSP, so stop it.
            if (loads.current > 1) setLeft("This game tried to open another page, so it was stopped.");
            else if (autoFocus) frameRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

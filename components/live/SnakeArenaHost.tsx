"use client";

import { useEffect, useRef, useState } from "react";
import type { HostView } from "@/lib/live/engine";
import { Arena, drawArena, type Snapshot } from "@/lib/live/snake";
import { openRoomChannel } from "@/lib/realtime/client";
import { card, clock } from "./ui";
import { recordSnake } from "./ReplayRecorder";

/**
 * Snake Arena on the host's big screen: this runs the arena for everyone,
 * sends the phones a snapshot 20 times a second (phones move their own snake and tell it where it went), and every few seconds
 * saves each player's longest snake as their score.
 */
export function SnakeArenaHost({ view, secondsLeft, onScores }: { view: HostView; secondsLeft: number | null; onScores: (scores: Record<string, number>) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const arena = useRef<Arena | null>(null);
  const [board, setBoard] = useState<{ name: string; color: string; len: number; best: number; bot: boolean }[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [bots, setBots] = useState(true);
  const scoresRef = useRef(onScores);
  useEffect(() => {
    scoresRef.current = onScores;
  }, [onScores]);

  // Everyone in the game gets a snake (and people who leave lose theirs).
  const roster = view.players.map((p) => `${p.id}:${p.name}`).join("|");
  useEffect(() => {
    arena.current ??= new Arena();
    const a = arena.current;
    const ids = new Set(view.players.map((p) => p.id));
    for (const p of view.players) a.join(p.id, p.name);
    for (const s of [...a.snakes.values()]) if (!s.bot && !ids.has(s.id)) a.leave(s.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster]);

  useEffect(() => {
    arena.current ??= new Arena();
    const a = arena.current;
    const ch = openRoomChannel(view.topic, null);
    const offs = [
      ch.on("snake-input", (p) => {
        const m = p as { id?: string; a?: number; b?: boolean };
        if (typeof m.id === "string") a.steer(m.id, Number(m.a), !!m.b);
      }),
      ch.on("snake-move", (p) => {
        const m = p as { id?: string; l?: number; p?: number[]; b?: boolean; n?: number };
        if (typeof m.id === "string" && Array.isArray(m.p) && typeof a.move === "function") a.move(m.id, Number(m.l), m.p, !!m.b, Date.now(), Number(m.n) || 0);
      }),
      ch.on("snake-feed", (p) => {
        const m = p as { playerId?: string; amount?: number };
        if (typeof m.playerId === "string") a.feed(m.playerId, Math.min(40, Number(m.amount) || 0));
      }),
    ];
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let latest: Snapshot | null = null;
    let lastTick = performance.now();
    let lastSent = 0;
    let lastSaved = performance.now();
    let lastBoard = 0;
    // The arena runs on a timer, so it keeps going even if the host's tab isn't in front
    // (animation frames stop in background tabs). Drawing uses animation frames.
    const sim = setInterval(() => {
      const now = performance.now();
      let pending = Math.min(1, (now - lastTick) / 1000);
      lastTick = now;
      while (pending > 0) {
        const dt = Math.min(0.04, pending);
        pending -= dt;
        a.step(dt, Date.now());
      }
      latest = a.snapshot(Date.now());
      recordSnake(latest);
      if (now - lastSent > 50) {
        lastSent = now;
        ch.send("snake-state", latest);
      }
      if (now - lastBoard > 500) {
        lastBoard = now;
        setBoard(
          [...a.snakes.values()]
            .map((s) => ({ name: s.name, color: s.color, len: Math.round(s.len), best: s.best, bot: s.bot }))
            .sort((x, y) => y.len - x.len)
            .slice(0, 10),
        );
        setEvents([...a.events]);
      }
      if (now - lastSaved > 3000) {
        lastSaved = now;
        const scores: Record<string, number> = {};
        for (const s of a.snakes.values()) if (!s.bot) scores[s.id] = s.best;
        scoresRef.current(scores);
      }
    }, 16);
    let raf = 0;
    const frame = (now: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawArena(ctx, w, h, latest, null, null, now);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      clearInterval(sim);
      cancelAnimationFrame(raf);
      offs.forEach((off) => off());
      ch.close();
    };
  }, [view.topic]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="relative">
        <canvas ref={canvasRef} className="aspect-square w-full rounded-3xl shadow-xl" aria-label="The Snake Arena" />
        <p className={`absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 font-mono text-2xl font-black text-white ${secondsLeft !== null && secondsLeft <= 10 ? "text-red-300" : ""}`}>
          {clock(secondsLeft)}
        </p>
        {events.length > 0 && (
          <ul className="absolute bottom-3 left-3 flex flex-col gap-1 text-sm font-bold text-white">
            {events.slice(0, 3).map((e, i) => (
              <li key={`${e}-${i}`} className="w-fit rounded-full bg-black/55 px-3 py-0.5" style={{ opacity: 1 - i * 0.25 }}>
                {e}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={`${card} flex flex-col gap-2`}>
        <p className="font-display text-xl font-extrabold">🐍 longest snakes</p>
        <ol className="flex flex-col gap-1.5">
          {board.map((s, i) => (
            <li key={`${s.name}-${i}`} className="flex items-center gap-2 text-sm">
              <span className="w-5 text-center font-mono text-muted">{i + 1}</span>
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className={`min-w-0 flex-1 truncate font-semibold ${s.bot ? "text-muted" : ""}`}>{s.name}</span>
              <span className="font-mono tabular-nums">{s.len}</span>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => {
            const on = !bots;
            setBots(on);
            if (arena.current) arena.current.botsOn = on;
          }}
          aria-pressed={bots}
          className="mt-2 rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:bg-accent/10"
        >
          🤖 bots: {bots ? "on" : "off"}
        </button>
        <p className="mt-auto text-xs text-muted">join at {typeof window !== "undefined" ? window.location.host : ""}/join w/ code {view.code}. right ansers = longer snake!!</p>
      </div>
    </div>
  );
}

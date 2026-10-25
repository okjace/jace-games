"use client";

import { useEffect, useRef, useState } from "react";
import { DPad, keyToDir, setupCanvas, themeColors, useKeys, useSwipe, type Dir } from "@/components/games/shared";
import { seededRandom } from "@/lib/multiplayer/rng";
import type { LiveGameProps } from "./live";
import { SEAT_COLORS } from "./types";

const COLS = 32;
const ROWS = 24;
const CELL = 20;
const W = COLS * CELL;
const H = ROWS * CELL;
const TICK_MS = 115;
const FOOD = 4;
const LIMIT_MS = 120_000;
const COUNTDOWN_MS = 3000;

type P = { x: number; y: number };
type SnakeP = { seat: number; body: P[]; dir: Dir; alive: boolean };
type ArenaState = { snakes: SnakeP[]; food: P[]; startAt: number; endAt: number; over: boolean };
const VEC: Record<Dir, P> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

const STARTS: { body: P[]; dir: Dir }[] = [
  { body: [{ x: 4, y: 4 }, { x: 3, y: 4 }, { x: 2, y: 4 }], dir: "right" },
  { body: [{ x: COLS - 5, y: ROWS - 5 }, { x: COLS - 4, y: ROWS - 5 }, { x: COLS - 3, y: ROWS - 5 }], dir: "left" },
  { body: [{ x: COLS - 5, y: 4 }, { x: COLS - 5, y: 3 }, { x: COLS - 5, y: 2 }], dir: "down" },
  { body: [{ x: 4, y: ROWS - 5 }, { x: 4, y: ROWS - 4 }, { x: 4, y: ROWS - 3 }], dir: "up" },
];

/**
 * Snake for 2–4 on one board. The host's browser runs the game (one tick
 * every 115 ms) and broadcasts it; everyone sends their turns. Bump into a
 * wall, yourself or another snake and you're out. Last snake left wins, or
 * the longest after two minutes.
 */
export default function SnakeArena({ seat, seed, isHost, players, channel, onEnd }: LiveGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const state = useRef<ArenaState | null>(null);
  const turns = useRef<Record<number, Dir[]>>({});
  const [hud, setHud] = useState<{ lengths: Record<number, number>; alive: number[]; left: number; countdown: number; over: boolean }>({
    lengths: {},
    alive: [],
    left: LIMIT_MS / 1000,
    countdown: 3,
    over: false,
  });
  const ended = useRef(false);
  const name = (s: number) => players.find((p) => p.seat === s)?.name ?? `Player ${s + 1}`;

  useEffect(() => {
    if (canvasRef.current) setupCanvas(canvasRef.current, W, H);
  }, []);

  // Host: set up the board and run the game.
  useEffect(() => {
    if (!isHost) return;
    const rand = seededRandom(seed);
    const now = Date.now();
    const snakes: SnakeP[] = players.map((p) => ({ seat: p.seat, body: STARTS[p.seat].body.map((b) => ({ ...b })), dir: STARTS[p.seat].dir, alive: true }));
    const s: ArenaState = { snakes, food: [], startAt: now + COUNTDOWN_MS, endAt: now + COUNTDOWN_MS + LIMIT_MS, over: false };
    const occupied = (x: number, y: number) => s.snakes.some((sn) => sn.alive && sn.body.some((b) => b.x === x && b.y === y)) || s.food.some((f) => f.x === x && f.y === y);
    const addFood = () => {
      for (let t = 0; t < 500; t++) {
        const p = { x: Math.floor(rand() * COLS), y: Math.floor(rand() * ROWS) };
        if (!occupied(p.x, p.y)) return void s.food.push(p);
      }
    };
    while (s.food.length < FOOD) addFood();
    state.current = s;

    const tick = () => {
      if (s.over || Date.now() < s.startAt) return;
      // Apply each snake's next queued turn.
      for (const sn of s.snakes) {
        if (!sn.alive) continue;
        const q = turns.current[sn.seat];
        while (q?.length) {
          const d = q.shift()!;
          if (d !== OPPOSITE[sn.dir] && d !== sn.dir) {
            sn.dir = d;
            break;
          }
        }
      }
      const heads = new Map<number, P>();
      for (const sn of s.snakes) if (sn.alive) heads.set(sn.seat, { x: sn.body[0].x + VEC[sn.dir].x, y: sn.body[0].y + VEC[sn.dir].y });
      const eats = new Set<number>();
      for (const [st, h] of heads) if (s.food.some((f) => f.x === h.x && f.y === h.y)) eats.add(st);
      const dead = new Set<number>();
      for (const [st, h] of heads) {
        if (h.x < 0 || h.y < 0 || h.x >= COLS || h.y >= ROWS) dead.add(st);
        for (const other of s.snakes) {
          if (!other.alive) continue;
          // Tails move out of the way unless that snake is eating.
          const body = eats.has(other.seat) ? other.body : other.body.slice(0, -1);
          if (body.some((b) => b.x === h.x && b.y === h.y)) dead.add(st);
        }
        for (const [o, oh] of heads) if (o !== st && oh.x === h.x && oh.y === h.y) dead.add(st);
      }
      for (const sn of s.snakes) {
        if (!sn.alive) continue;
        if (dead.has(sn.seat)) {
          sn.alive = false;
          continue;
        }
        const h = heads.get(sn.seat)!;
        sn.body = [h, ...(eats.has(sn.seat) ? sn.body : sn.body.slice(0, -1))];
      }
      s.food = s.food.filter((f) => !s.snakes.some((sn) => sn.alive && sn.body[0].x === f.x && sn.body[0].y === f.y));
      while (s.food.length < FOOD) addFood();

      const alive = s.snakes.filter((sn) => sn.alive);
      const timeUp = Date.now() >= s.endAt;
      if ((alive.length <= 1 && s.snakes.length > 1) || alive.length === 0 || timeUp) {
        s.over = true;
        // Winner: the last one alive; otherwise the longest of those still in (or who died last).
        const pool = alive.length ? alive : s.snakes.filter((sn) => dead.has(sn.seat));
        const best = Math.max(...pool.map((sn) => sn.body.length));
        const winners = pool.filter((sn) => sn.body.length === best).map((sn) => sn.seat);
        const scores = Object.fromEntries(s.snakes.map((sn) => [String(sn.seat), sn.body.length]));
        channel?.send("state", s);
        if (!ended.current) {
          ended.current = true;
          setTimeout(() => onEnd(winners, scores), 1200);
        }
      }
      channel?.send("state", s);
    };
    const t = setInterval(tick, TICK_MS);
    const announce = setInterval(() => channel?.send("state", s), 500);
    return () => {
      clearInterval(t);
      clearInterval(announce);
    };
    // Set up once per game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, seed]);

  // Network: the host collects turns; everyone else follows the state.
  useEffect(() => {
    if (!channel) return;
    if (isHost) {
      return channel.on("turn", (p) => {
        const { seat: st, dir } = p as { seat: number; dir: Dir };
        if (!VEC[dir] || !players.some((pl) => pl.seat === st)) return;
        const q = (turns.current[st] ??= []);
        if (q.length < 3) q.push(dir);
      });
    }
    return channel.on("state", (p) => {
      state.current = p as ArenaState;
    });
  }, [channel, isHost, players]);

  const turn = (d: Dir) => {
    if (isHost) (turns.current[seat] ??= []).push(d);
    else channel?.send("turn", { seat, dir: d });
  };

  useKeys((e) => {
    const d = keyToDir(e.key);
    if (!d) return;
    e.preventDefault();
    turn(d);
  });
  useSwipe(boardRef, turn);

  // Draw at 60 fps and keep the scoreboard fresh.
  useEffect(() => {
    let raf = 0;
    let lastHud = 0;
    const frame = (now: number) => {
      const s = state.current;
      const canvas = canvasRef.current;
      if (s && canvas) {
        const ctx = canvas.getContext("2d")!;
        const c = themeColors();
        ctx.fillStyle = c.panel;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = c.line;
        for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) if ((x + y) % 2 === 0) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        ctx.fillStyle = c.danger;
        for (const f of s.food) {
          ctx.beginPath();
          ctx.arc(f.x * CELL + CELL / 2, f.y * CELL + CELL / 2, CELL / 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
        for (const sn of s.snakes) {
          ctx.globalAlpha = sn.alive ? 1 : 0.25;
          sn.body.forEach((b, i) => {
            ctx.fillStyle = SEAT_COLORS[sn.seat];
            ctx.beginPath();
            ctx.roundRect(b.x * CELL + 1, b.y * CELL + 1, CELL - 2, CELL - 2, i === 0 ? 7 : 4);
            ctx.fill();
            if (i === 0 && sn.seat === seat && sn.alive) {
              ctx.strokeStyle = c.foreground;
              ctx.lineWidth = 2;
              ctx.stroke();
            }
          });
        }
        ctx.globalAlpha = 1;
        if (now - lastHud > 200) {
          lastHud = now;
          setHud({
            lengths: Object.fromEntries(s.snakes.map((sn) => [sn.seat, sn.body.length])),
            alive: s.snakes.filter((sn) => sn.alive).map((sn) => sn.seat),
            left: Math.max(0, Math.ceil((s.endAt - Date.now()) / 1000)),
            countdown: Math.max(0, Math.ceil((s.startAt - Date.now()) / 1000)),
            over: s.over,
          });
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [seat]);

  const meAlive = hud.alive.includes(seat);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        {players.map((p) => (
          <span key={p.seat} className={`flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1 ${hud.alive.includes(p.seat) ? "" : "opacity-50 line-through"}`}>
            <span className="h-3 w-3 rounded-full" style={{ background: SEAT_COLORS[p.seat] }} />
            {p.name}
            {p.seat === seat && <span className="text-muted">(you)</span>}
            <span className="font-semibold tabular-nums">{hud.lengths[p.seat] ?? 3}</span>
          </span>
        ))}
        <span className="rounded-full border border-line bg-panel px-3 py-1 font-mono tabular-nums">
          {Math.floor(hud.left / 60)}:{String(hud.left % 60).padStart(2, "0")}
        </span>
      </div>
      <div ref={boardRef} className="touch-game relative w-full max-w-[640px]" style={{ aspectRatio: `${COLS} / ${ROWS}` }}>
        <canvas ref={canvasRef} className="h-full w-full rounded-2xl border border-line" aria-label="Snake arena. Steer with the arrow keys, WASD, swipes or the pad." />
        {hud.countdown > 0 && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/50">
            <p className="text-6xl font-black tabular-nums">{hud.countdown}</p>
          </div>
        )}
        {!meAlive && hud.alive.length > 0 && hud.countdown === 0 && !hud.over && (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
            <p className="rounded-full bg-background/80 px-4 py-1.5 text-sm font-semibold">You&apos;re out. Watching {hud.alive.map(name).join(", ")}…</p>
          </div>
        )}
      </div>
      <DPad onDir={turn} className="[@media(pointer:fine)]:hidden" />
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { setupCanvas, themeColors, useKeys } from "@/components/games/shared";
import type { LiveGameProps } from "./live";
import { SEAT_COLORS } from "./types";

const W = 800;
const H = 500;
const PADDLE_H = 90;
const PADDLE_W = 14;
const BALL = 12;
const WIN = 7;
const SEND_MS = 33;

type PongState = { ball: { x: number; y: number; vx: number; vy: number }; paddles: [number, number]; score: [number, number]; serveIn: number; over: boolean };

/**
 * Real-time Pong. The host (left paddle) runs the physics and broadcasts the
 * state; the other player sends where their paddle is.
 */
export default function Pong({ seat, isHost, players, channel, online, onEnd }: LiveGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef<PongState>({ ball: { x: W / 2, y: H / 2, vx: 0, vy: 0 }, paddles: [H / 2, H / 2], score: [0, 0], serveIn: 1.5, over: false });
  const myY = useRef(H / 2);
  const keys = useRef({ up: false, down: false });
  const [score, setScore] = useState<[number, number]>([0, 0]);
  const [waiting, setWaiting] = useState(!isHost);
  const ended = useRef(false);
  const name = (s: number) => players.find((p) => p.seat === s)?.name ?? `Player ${s + 1}`;
  const side = seat === 0 ? 0 : 1;

  useEffect(() => {
    if (canvasRef.current) setupCanvas(canvasRef.current, W, H);
  }, []);

  // Network: the host listens for the guest's paddle; guests listen for state.
  useEffect(() => {
    if (!channel) return;
    if (isHost) return channel.on("input", (p) => {
      const y = Number((p as { y: number }).y);
      if (Number.isFinite(y)) state.current.paddles[1] = Math.max(PADDLE_H / 2, Math.min(H - PADDLE_H / 2, y));
    });
    return channel.on("state", (p) => {
      state.current = p as PongState;
      setWaiting(false);
      setScore([...(p as PongState).score] as [number, number]);
    });
  }, [channel, isHost]);

  useKeys((e) => {
    if (["ArrowUp", "w", "W"].includes(e.key)) keys.current.up = true;
    else if (["ArrowDown", "s", "S"].includes(e.key)) keys.current.down = true;
    else return;
    e.preventDefault();
  });
  useEffect(() => {
    const up = (e: KeyboardEvent) => {
      if (["ArrowUp", "w", "W"].includes(e.key)) keys.current.up = false;
      if (["ArrowDown", "s", "S"].includes(e.key)) keys.current.down = false;
    };
    window.addEventListener("keyup", up);
    return () => window.removeEventListener("keyup", up);
  }, []);

  // Main loop: move my paddle, simulate (host), send, draw.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let sent = 0;
    const opponent = players.find((p) => p.seat !== seat);
    let goneSince: number | null = null;
    const frame = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const s = state.current;
      const dir = (keys.current.down ? 1 : 0) - (keys.current.up ? 1 : 0);
      if (dir) myY.current = Math.max(PADDLE_H / 2, Math.min(H - PADDLE_H / 2, myY.current + dir * 520 * dt));
      s.paddles[side] = myY.current;

      if (isHost && !s.over) {
        // The other player left the room's live channel for a while: you win.
        const here = !opponent?.userId || online.includes(opponent.userId);
        if (!here) goneSince ??= now;
        else goneSince = null;
        if (goneSince && now - goneSince > 15_000 && !ended.current) {
          ended.current = true;
          s.over = true;
          onEnd([seat], { 0: s.score[0], 1: s.score[1] });
        }
        step(s, dt);
        if (s.score[0] >= WIN || s.score[1] >= WIN) {
          s.over = true;
          if (!ended.current) {
            ended.current = true;
            const winner = s.score[0] > s.score[1] ? 0 : 1;
            channel?.send("state", s);
            onEnd([winner], { 0: s.score[0], 1: s.score[1] });
          }
        }
        if (now - sent > SEND_MS) {
          sent = now;
          channel?.send("state", s);
          setScore((cur) => (cur[0] !== s.score[0] || cur[1] !== s.score[1] ? [s.score[0], s.score[1]] : cur));
        }
      } else if (!isHost && now - sent > SEND_MS) {
        sent = now;
        channel?.send("input", { y: myY.current });
      }
      draw(canvasRef.current, s, seat);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [isHost, channel, side, seat, players, online, onEnd]);

  const movePointer = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    myY.current = Math.max(PADDLE_H / 2, Math.min(H - PADDLE_H / 2, ((e.clientY - r.top) / r.height) * H));
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full max-w-[720px] items-center justify-between text-lg font-semibold">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: SEAT_COLORS[0] }} />
          {name(0)}
          {seat === 0 && <span className="text-sm font-normal text-muted">(you)</span>}
        </span>
        <span className="font-mono text-3xl tabular-nums">
          {score[0]} : {score[1]}
        </span>
        <span className="flex items-center gap-2">
          {seat === 1 && <span className="text-sm font-normal text-muted">(you)</span>}
          {name(1)}
          <span className="h-3 w-3 rounded-full" style={{ background: SEAT_COLORS[1] }} />
        </span>
      </div>
      <div className="relative w-full max-w-[720px]">
        <canvas
          ref={canvasRef}
          onPointerMove={movePointer}
          onPointerDown={movePointer}
          className="touch-game aspect-[8/5] w-full rounded-2xl border border-line"
          aria-label="Pong. Move your paddle with the arrow keys, W and S, or by dragging."
        />
        {waiting && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/70">
            <p className="text-sm text-muted">Connecting to {name(0)}…</p>
          </div>
        )}
      </div>
      <p className="text-xs text-muted">↑/↓ or W/S, or drag on the court. First to {WIN}.</p>
    </div>
  );
}

function step(s: PongState, dt: number) {
  const b = s.ball;
  if (s.serveIn > 0) {
    s.serveIn -= dt;
    b.x = W / 2;
    b.y = H / 2;
    if (s.serveIn <= 0) {
      const dir = (s.score[0] + s.score[1]) % 2 === 0 ? 1 : -1;
      const angle = (Math.random() - 0.5) * 0.9;
      b.vx = Math.cos(angle) * 360 * dir;
      b.vy = Math.sin(angle) * 360;
    }
    return;
  }
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  if (b.y < BALL / 2) {
    b.y = BALL / 2;
    b.vy = Math.abs(b.vy);
  }
  if (b.y > H - BALL / 2) {
    b.y = H - BALL / 2;
    b.vy = -Math.abs(b.vy);
  }
  for (const p of [0, 1] as const) {
    const px = p === 0 ? 30 : W - 30;
    const py = s.paddles[p];
    const towards = p === 0 ? b.vx < 0 : b.vx > 0;
    if (towards && Math.abs(b.x - px) < PADDLE_W / 2 + BALL / 2 && Math.abs(b.y - py) < PADDLE_H / 2 + BALL / 2) {
      const hit = (b.y - py) / (PADDLE_H / 2);
      const speed = Math.min(900, Math.hypot(b.vx, b.vy) * 1.06);
      const angle = hit * 0.9;
      b.vx = Math.cos(angle) * speed * (p === 0 ? 1 : -1);
      b.vy = Math.sin(angle) * speed;
      b.x = px + (p === 0 ? 1 : -1) * (PADDLE_W / 2 + BALL / 2);
    }
  }
  if (b.x < -BALL || b.x > W + BALL) {
    s.score[b.x < 0 ? 1 : 0]++;
    s.serveIn = 1;
  }
}

function draw(canvas: HTMLCanvasElement | null, s: PongState, seat: number) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d")!;
  const c = themeColors();
  ctx.fillStyle = c.panel;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = c.line;
  ctx.setLineDash([10, 12]);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const p of [0, 1] as const) {
    ctx.fillStyle = SEAT_COLORS[p];
    ctx.globalAlpha = p === seat ? 1 : 0.85;
    ctx.beginPath();
    ctx.roundRect((p === 0 ? 30 : W - 30) - PADDLE_W / 2, s.paddles[p] - PADDLE_H / 2, PADDLE_W, PADDLE_H, 6);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = c.foreground;
  ctx.beginPath();
  ctx.arc(s.ball.x, s.ball.y, BALL / 2, 0, Math.PI * 2);
  ctx.fill();
}

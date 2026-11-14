"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DPad,
  GameOver,
  Overlay,
  Stats,
  beats,
  keyToDir,
  primaryButton,
  setupCanvas,
  themeColors,
  useKeys,
  useSwipe,
  type Dir,
  type GameProps,
} from "./shared";
import { Fx, sfx, shade } from "./fx";

const GRID = 20;
const SIZE = 400; // logical px
const CELL = SIZE / GRID;
const START_TICK = 120;
const MIN_TICK = 70;

type P = { x: number; y: number };
const VEC: Record<Dir, P> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

function randomFood(snake: P[]): P {
  const free: P[] = [];
  for (let x = 0; x < GRID; x++)
    for (let y = 0; y < GRID; y++) if (!snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
  return free[Math.floor(Math.random() * free.length)] ?? { x: 0, y: 0 };
}

export default function Snake({ onFinish, best }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"idle" | "running" | "paused" | "over">("idle");
  const [score, setScore] = useState(0);
  const [finalBest, setFinalBest] = useState(false);

  const fx = useRef(new Fx());
  const g = useRef({
    snake: [{ x: 10, y: 10 }] as P[],
    /** Where each segment was before the last step, for smooth movement between steps. */
    prev: [{ x: 10, y: 10 }] as P[],
    /** How far through the current step we are (0–1). */
    k: 1,
    ateAt: 0,
    deadAt: 0,
    dir: "right" as Dir,
    queue: [] as Dir[],
    food: { x: 15, y: 10 } as P,
    score: 0,
    startedAt: 0,
    acc: 0,
    last: 0,
  });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const c = themeColors();
    const now = performance.now();
    const f = fx.current;
    f.begin(ctx);
    // The board: a soft checkerboard with a glow in the middle.
    ctx.fillStyle = c.panel;
    ctx.fillRect(-10, -10, SIZE + 20, SIZE + 20);
    ctx.fillStyle = c.line;
    ctx.globalAlpha = 0.55;
    for (let x = 0; x < GRID; x++) for (let y = 0; y < GRID; y++) if ((x + y) % 2 === 0) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    ctx.globalAlpha = 1;
    const glow = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 20, SIZE / 2, SIZE / 2, SIZE * 0.75);
    glow.addColorStop(0, "rgba(61,220,132,0.08)");
    glow.addColorStop(1, "rgba(0,0,0,0.18)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, SIZE, SIZE);
    const { snake, prev, food, k, dir } = g.current;
    // Food: a glowing apple that pulses.
    const fx0 = food.x * CELL + CELL / 2;
    const fy0 = food.y * CELL + CELL / 2;
    const pulse = 1 + Math.sin(now / 180) * 0.08;
    ctx.shadowColor = c.danger;
    ctx.shadowBlur = 14;
    ctx.fillStyle = c.danger;
    ctx.beginPath();
    ctx.arc(fx0, fy0 + 1, (CELL / 2.5) * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.arc(fx0 - 3, fy0 - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4ade80";
    ctx.beginPath();
    ctx.ellipse(fx0 + 3, fy0 - CELL / 2.6, 4, 2, -0.6, 0, Math.PI * 2);
    ctx.fill();
    // The snake, gliding between steps: a gradient body, fattest at the head.
    const pos = snake.map((p, i) => {
      const q = prev[i] ?? prev[prev.length - 1] ?? p;
      return { x: (q.x + (p.x - q.x) * k) * CELL + CELL / 2, y: (q.y + (p.y - q.y) * k) * CELL + CELL / 2 };
    });
    const dead = g.current.deadAt && now - g.current.deadAt < 600;
    for (let i = pos.length - 1; i >= 0; i--) {
      const t = i / Math.max(1, pos.length - 1);
      const r = CELL * (0.46 - t * 0.14);
      ctx.fillStyle = dead ? shade(c.danger, -0.1 * t) : shade(c.accent, 0.15 - t * 0.45);
      ctx.beginPath();
      ctx.arc(pos[i].x, pos[i].y, r, 0, Math.PI * 2);
      ctx.fill();
      // Fill the gap to the next segment so the body is one smooth tube.
      if (i > 0) {
        const a = pos[i - 1];
        ctx.beginPath();
        ctx.arc((a.x + pos[i].x) / 2, (a.y + pos[i].y) / 2, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Head: eyes looking where it's going, and a happy gulp after eating.
    if (pos[0]) {
      const v = VEC[dir];
      const h = pos[0];
      const px = -v.y;
      const py = v.x;
      for (const side of [-1, 1]) {
        const ex = h.x + v.x * 4 + px * side * 5;
        const ey = h.y + v.y * 4 + py * side * 5;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(ex, ey, 3.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.arc(ex + v.x * 1.4, ey + v.y * 1.4, dead ? 1 : 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      if (now - g.current.ateAt < 220) {
        ctx.fillStyle = "#7f1d1d";
        ctx.beginPath();
        ctx.arc(h.x + v.x * 8, h.y + v.y * 8, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    f.draw(ctx);
  }, []);

  useEffect(() => {
    if (canvasRef.current) setupCanvas(canvasRef.current, SIZE, SIZE);
    draw();
    const obs = new MutationObserver(draw);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, [draw]);

  const start = useCallback(() => {
    const s = g.current;
    s.snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    s.prev = s.snake.map((p) => ({ ...p }));
    s.k = 1;
    s.deadAt = 0;
    fx.current.clear();
    s.dir = "right";
    s.queue = [];
    s.food = randomFood(s.snake);
    s.score = 0;
    s.startedAt = performance.now();
    s.acc = 0;
    s.last = 0;
    setScore(0);
    setPhase("running");
    boardRef.current?.focus({ preventScroll: true });
  }, []);

  const turn = useCallback((d: Dir) => {
    const s = g.current;
    const lastDir = s.queue[s.queue.length - 1] ?? s.dir;
    const v = VEC[d];
    const lv = VEC[lastDir];
    if (d === lastDir || (v.x === -lv.x && v.y === -lv.y)) return;
    if (s.queue.length < 3) s.queue.push(d);
  }, []);

  // Game loop.
  useEffect(() => {
    if (phase !== "running") return;
    let raf = 0;
    const s = g.current;
    s.last = performance.now();
    const step = () => {
      if (s.queue.length) s.dir = s.queue.shift()!;
      const head = { x: s.snake[0].x + VEC[s.dir].x, y: s.snake[0].y + VEC[s.dir].y };
      const eating = head.x === s.food.x && head.y === s.food.y;
      const body = eating ? s.snake : s.snake.slice(0, -1);
      if (
        head.x < 0 ||
        head.y < 0 ||
        head.x >= GRID ||
        head.y >= GRID ||
        body.some((p) => p.x === head.x && p.y === head.y)
      ) {
        return false;
      }
      s.prev = s.snake.map((p) => ({ ...p }));
      if (eating) s.prev.push({ ...s.prev[s.prev.length - 1] });
      s.snake = [head, ...body];
      if (eating) {
        s.score += 1;
        setScore(s.score);
        s.ateAt = performance.now();
        const fxc = themeColors();
        fx.current.burst(head.x * CELL + CELL / 2, head.y * CELL + CELL / 2, [fxc.danger, fxc.warn, fxc.accent], 16, 150, 120);
        fx.current.float(head.x * CELL + CELL / 2, head.y * CELL - 4, "+1", fxc.accent);
        // Every 10 the snake speeds up.
        if (s.score % 10 === 0) {
          sfx.levelUp();
          fx.current.float(SIZE / 2, SIZE / 2, "Speed up!", fxc.warn, 30);
        } else sfx.coin();
        if (s.snake.length >= GRID * GRID) return false;
        s.food = randomFood(s.snake);
      }
      return true;
    };
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - s.last) / 1000);
      s.acc += now - s.last;
      s.last = now;
      fx.current.update(dt);
      const tick = Math.max(MIN_TICK, START_TICK - s.score * 2);
      while (s.acc >= tick) {
        s.acc -= tick;
        if (!step()) {
          // Crash: a jolt, a burst and a sad sound, and the effects play out.
          s.k = 1;
          s.deadAt = performance.now();
          const fxc = themeColors();
          fx.current.shake(8, 0.35);
          fx.current.burst(s.snake[0].x * CELL + CELL / 2, s.snake[0].y * CELL + CELL / 2, [fxc.danger, fxc.accent], 26, 220, 200, 4);
          sfx.wrong();
          let last = performance.now();
          const after = (t: number) => {
            fx.current.update(Math.min(0.05, (t - last) / 1000));
            last = t;
            draw();
            if (fx.current.busy || t - s.deadAt < 600) requestAnimationFrame(after);
          };
          requestAnimationFrame(after);
          const duration = performance.now() - s.startedAt;
          setFinalBest(beats(s.score, best, "higher") && s.score > 0);
          setPhase("over");
          onFinish(s.score, duration);
          return;
        }
      }
      s.k = Math.min(1, s.acc / tick);
      draw();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, draw, onFinish, best]);

  useKeys((e) => {
    const d = keyToDir(e.key);
    if (phase === "running") {
      if (d) {
        e.preventDefault();
        turn(d);
      } else if (e.key === "p" || e.key === "Escape" || e.key === " ") {
        e.preventDefault();
        setPhase("paused");
      }
    } else if (phase === "paused") {
      if (e.key === "p" || e.key === "Escape" || e.key === " " || e.key === "Enter" || d) {
        e.preventDefault();
        setPhase("running");
      }
    } else if (e.key === "Enter" || e.key === " " || (phase === "idle" && d)) {
      e.preventDefault();
      start();
      if (d) turn(d);
    }
  });

  useSwipe(boardRef, (d) => (phase === "running" ? turn(d) : undefined));

  return (
    <div className="flex flex-col items-center gap-4">
      <Stats items={[{ label: "Food", value: score }, { label: "Best", value: best ?? "—", accent: true }]} />
      <div
        ref={boardRef}
        tabIndex={0}
        aria-label="Snake board. Use the arrow keys or WASD to steer, P to pause."
        className="touch-game relative aspect-square w-full max-w-[480px] rounded-2xl border border-line outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <canvas ref={canvasRef} className="h-full w-full rounded-2xl" />
        {phase === "idle" && (
          <Overlay>
            <p className="text-sm text-muted">Arrow keys or WASD to steer. On a phone, swipe or use the pad.</p>
            <button type="button" onClick={start} className={primaryButton}>
              Start
            </button>
          </Overlay>
        )}
        {phase === "paused" && (
          <Overlay>
            <p className="text-lg font-semibold">Paused</p>
            <button type="button" onClick={() => setPhase("running")} className={primaryButton}>
              Resume
            </button>
          </Overlay>
        )}
        {phase === "over" && <GameOver score={`${score} food`} isBest={finalBest} onAgain={start} />}
      </div>
      <DPad onDir={(d) => (phase === "running" ? turn(d) : phase !== "paused" ? (start(), turn(d)) : setPhase("running"))} className="[@media(pointer:fine)]:hidden" />
    </div>
  );
}

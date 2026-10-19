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

  const g = useRef({
    snake: [{ x: 10, y: 10 }] as P[],
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
    ctx.fillStyle = c.panel;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = c.line;
    for (let x = 0; x < GRID; x++)
      for (let y = 0; y < GRID; y++) if ((x + y) % 2 === 0) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    const { snake, food } = g.current;
    ctx.fillStyle = c.danger;
    ctx.beginPath();
    ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2.6, 0, Math.PI * 2);
    ctx.fill();
    snake.forEach((s, i) => {
      ctx.fillStyle = c.accent;
      ctx.globalAlpha = i === 0 ? 1 : Math.max(0.45, 1 - i / (snake.length + 8));
      ctx.beginPath();
      ctx.roundRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2, 5);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
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
      s.snake = [head, ...body];
      if (eating) {
        s.score += 1;
        setScore(s.score);
        if (s.snake.length >= GRID * GRID) return false;
        s.food = randomFood(s.snake);
      }
      return true;
    };
    const frame = (now: number) => {
      s.acc += now - s.last;
      s.last = now;
      const tick = Math.max(MIN_TICK, START_TICK - s.score * 2);
      while (s.acc >= tick) {
        s.acc -= tick;
        if (!step()) {
          draw();
          const duration = performance.now() - s.startedAt;
          setFinalBest(beats(s.score, best, "higher") && s.score > 0);
          setPhase("over");
          onFinish(s.score, duration);
          return;
        }
      }
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

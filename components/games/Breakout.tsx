"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameOver, Overlay, Stats, beats, primaryButton, setupCanvas, themeColors, useKeys, type GameProps } from "./shared";

const W = 400;
const H = 520;
const COLS = 8;
const ROWS = 6;
const BRICK_H = 18;
const BRICK_GAP = 5;
const TOP = 60;
const PADDLE_W = 76;
const PADDLE_H = 12;
const PADDLE_Y = H - 36;
const BALL_R = 7;
const ROW_POINTS = [60, 50, 40, 30, 20, 10];
const ROW_COLORS = ["#f87171", "#fb923c", "#facc15", "#3ddc84", "#38bdf8", "#a78bfa"];

type Brick = { x: number; y: number; w: number; row: number; alive: boolean };

function makeBricks(): Brick[] {
  const w = (W - BRICK_GAP * (COLS + 1)) / COLS;
  const out: Brick[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      out.push({ x: BRICK_GAP + c * (w + BRICK_GAP), y: TOP + r * (BRICK_H + BRICK_GAP), w, row: r, alive: true });
  return out;
}

export default function Breakout({ onFinish, best }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"idle" | "running" | "over">("idle");
  const [hud, setHud] = useState({ score: 0, lives: 3, level: 1 });
  const [wasBest, setWasBest] = useState(false);
  const g = useRef({
    px: W / 2,
    bx: W / 2,
    by: PADDLE_Y - BALL_R,
    vx: 0,
    vy: 0,
    stuck: true,
    bricks: makeBricks(),
    score: 0,
    lives: 3,
    level: 1,
    keys: { left: false, right: false },
    startedAt: 0,
  });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const c = themeColors();
    const s = g.current;
    ctx.fillStyle = c.panel;
    ctx.fillRect(0, 0, W, H);
    for (const b of s.bricks) {
      if (!b.alive) continue;
      ctx.fillStyle = ROW_COLORS[b.row];
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, BRICK_H, 5);
      ctx.fill();
    }
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.roundRect(s.px - PADDLE_W / 2, PADDLE_Y, PADDLE_W, PADDLE_H, 6);
    ctx.fill();
    ctx.fillStyle = c.foreground;
    ctx.beginPath();
    ctx.arc(s.bx, s.by, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    if (s.stuck && phase === "running") {
      ctx.fillStyle = c.muted;
      ctx.font = "14px var(--font-geist-sans), sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Tap or press Space to launch", W / 2, H / 2 + 40);
    }
  }, [phase]);

  useEffect(() => {
    if (canvasRef.current) setupCanvas(canvasRef.current, W, H);
    draw();
    const obs = new MutationObserver(draw);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, [draw]);

  const launch = () => {
    const s = g.current;
    if (!s.stuck) return;
    const speed = 300 + (s.level - 1) * 40;
    const angle = (-Math.PI / 2) + (Math.random() - 0.5) * 0.8;
    s.vx = Math.cos(angle) * speed;
    s.vy = Math.sin(angle) * speed;
    s.stuck = false;
  };

  const start = useCallback(() => {
    Object.assign(g.current, {
      px: W / 2,
      stuck: true,
      bricks: makeBricks(),
      score: 0,
      lives: 3,
      level: 1,
      startedAt: performance.now(),
    });
    setHud({ score: 0, lives: 3, level: 1 });
    setPhase("running");
  }, []);

  useEffect(() => {
    if (phase !== "running") return;
    const s = g.current;
    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.025, (now - last) / 1000);
      last = now;
      const dir = (s.keys.right ? 1 : 0) - (s.keys.left ? 1 : 0);
      s.px = Math.max(PADDLE_W / 2, Math.min(W - PADDLE_W / 2, s.px + dir * 460 * dt));

      if (s.stuck) {
        s.bx = s.px;
        s.by = PADDLE_Y - BALL_R - 1;
      } else {
        // Sub-steps keep a fast ball from tunnelling through bricks.
        const steps = 3;
        for (let k = 0; k < steps; k++) {
          s.bx += (s.vx * dt) / steps;
          s.by += (s.vy * dt) / steps;
          if (s.bx < BALL_R) {
            s.bx = BALL_R;
            s.vx = Math.abs(s.vx);
          }
          if (s.bx > W - BALL_R) {
            s.bx = W - BALL_R;
            s.vx = -Math.abs(s.vx);
          }
          if (s.by < BALL_R) {
            s.by = BALL_R;
            s.vy = Math.abs(s.vy);
          }
          // Paddle: the bounce angle depends on where the ball hits.
          if (
            s.vy > 0 &&
            s.by + BALL_R >= PADDLE_Y &&
            s.by + BALL_R <= PADDLE_Y + PADDLE_H + 6 &&
            Math.abs(s.bx - s.px) <= PADDLE_W / 2 + BALL_R
          ) {
            const speed = Math.hypot(s.vx, s.vy) * 1.01;
            const hit = (s.bx - s.px) / (PADDLE_W / 2);
            const angle = -Math.PI / 2 + Math.max(-1, Math.min(1, hit)) * 1.05;
            s.vx = Math.cos(angle) * speed;
            s.vy = Math.sin(angle) * speed;
            s.by = PADDLE_Y - BALL_R;
          }
          for (const b of s.bricks) {
            if (!b.alive) continue;
            const cx = Math.max(b.x, Math.min(s.bx, b.x + b.w));
            const cy = Math.max(b.y, Math.min(s.by, b.y + BRICK_H));
            if ((s.bx - cx) ** 2 + (s.by - cy) ** 2 > BALL_R ** 2) continue;
            b.alive = false;
            s.score += ROW_POINTS[b.row];
            const overlapX = Math.min(s.bx + BALL_R - b.x, b.x + b.w - (s.bx - BALL_R));
            const overlapY = Math.min(s.by + BALL_R - b.y, b.y + BRICK_H - (s.by - BALL_R));
            if (overlapX < overlapY) s.vx = -s.vx;
            else s.vy = -s.vy;
            setHud((h) => ({ ...h, score: s.score }));
            break;
          }
        }
        if (s.by > H + BALL_R) {
          s.lives -= 1;
          s.stuck = true;
          setHud((h) => ({ ...h, lives: s.lives }));
          if (s.lives <= 0) {
            draw();
            setWasBest(s.score > 0 && beats(s.score, best, "higher"));
            setPhase("over");
            onFinish(s.score, performance.now() - s.startedAt);
            return;
          }
        }
        if (s.bricks.every((b) => !b.alive)) {
          s.level += 1;
          s.bricks = makeBricks();
          s.stuck = true;
          setHud((h) => ({ ...h, level: s.level }));
        }
      }
      draw();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, draw, onFinish, best]);

  useKeys((e) => {
    const s = g.current;
    if (phase === "running") {
      if (e.key === "ArrowLeft" || e.key === "a") s.keys.left = true;
      else if (e.key === "ArrowRight" || e.key === "d") s.keys.right = true;
      else if (e.key === " " || e.key === "ArrowUp") launch();
      else return;
      e.preventDefault();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      start();
    }
  });
  useEffect(() => {
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") g.current.keys.left = false;
      if (e.key === "ArrowRight" || e.key === "d") g.current.keys.right = false;
    };
    window.addEventListener("keyup", up);
    return () => window.removeEventListener("keyup", up);
  }, []);

  // Mouse or finger moves the paddle directly.
  const movePaddle = (e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    g.current.px = Math.max(PADDLE_W / 2, Math.min(W - PADDLE_W / 2, ((e.clientX - rect.left) / rect.width) * W));
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <Stats
        items={[
          { label: "Score", value: hud.score.toLocaleString() },
          { label: "Lives", value: "♥".repeat(Math.max(0, hud.lives)) || "—" },
          { label: "Level", value: hud.level },
          { label: "Best", value: best?.toLocaleString() ?? "—", accent: true },
        ]}
      />
      <div
        className="touch-game relative w-full"
        style={{ aspectRatio: `${W} / ${H}`, maxWidth: `min(${W}px, calc(72vh * ${W / H}))` }}
        onPointerMove={(e) => phase === "running" && movePaddle(e)}
        onPointerDown={(e) => {
          if (phase !== "running") return;
          movePaddle(e);
          if (e.pointerType !== "mouse" || e.button === 0) launch();
        }}
      >
        <canvas ref={canvasRef} className="h-full w-full rounded-2xl border border-line" aria-label="Breakout board" />
        {phase === "idle" && (
          <Overlay>
            <p className="text-sm text-muted">Move with the mouse, your finger, or ← →. Space or tap to launch.</p>
            <button type="button" onClick={start} className={primaryButton}>
              Start
            </button>
          </Overlay>
        )}
        {phase === "over" && <GameOver score={hud.score.toLocaleString()} isBest={wasBest} onAgain={start} extra={<p className="text-sm text-muted">Reached level {hud.level}</p>} />}
      </div>
    </div>
  );
}

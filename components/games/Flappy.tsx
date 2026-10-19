"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameOver, Overlay, Stats, beats, primaryButton, setupCanvas, themeColors, useKeys, type GameProps } from "./shared";

const W = 360;
const H = 540;
const GROUND = 40;
const BIRD_X = 90;
const R = 13;
const GRAVITY = 1500; // px/s²
const FLAP = -460; // px/s
const SPEED = 160; // px/s
const PIPE_W = 60;
const GAP = 150;
const PIPE_EVERY = 1.4; // s

type Pipe = { x: number; gapY: number; passed: boolean };

export default function Flappy({ onFinish, best }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"idle" | "running" | "over">("idle");
  const [score, setScore] = useState(0);
  const [wasBest, setWasBest] = useState(false);
  const g = useRef({ y: H / 2, vy: 0, pipes: [] as Pipe[], score: 0, spawnIn: 0, startedAt: 0, t: 0, overAt: 0 });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const c = themeColors();
    const s = g.current;
    ctx.fillStyle = c.panel;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = c.accent;
    for (const p of s.pipes) {
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.roundRect(p.x, -10, PIPE_W, p.gapY - GAP / 2 + 10, 8);
      ctx.roundRect(p.x, p.gapY + GAP / 2, PIPE_W, H - GROUND - (p.gapY + GAP / 2) + 10, 8);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = c.line;
    ctx.fillRect(0, H - GROUND, W, GROUND);
    // Bird.
    ctx.save();
    ctx.translate(BIRD_X, s.y);
    ctx.rotate(Math.max(-0.5, Math.min(1.2, s.vy / 600)));
    ctx.fillStyle = c.warn;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.foreground;
    ctx.beginPath();
    ctx.arc(5, -4, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.danger;
    ctx.beginPath();
    ctx.moveTo(R - 2, 0);
    ctx.lineTo(R + 7, 3);
    ctx.lineTo(R - 2, 6);
    ctx.fill();
    ctx.restore();
    // Score.
    ctx.fillStyle = c.foreground;
    ctx.font = "bold 40px var(--font-geist-sans), sans-serif";
    ctx.textAlign = "center";
    if (s.pipes.length || s.score) ctx.fillText(String(s.score), W / 2, 70);
  }, []);

  useEffect(() => {
    if (canvasRef.current) setupCanvas(canvasRef.current, W, H);
    draw();
    const obs = new MutationObserver(draw);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, [draw]);

  const start = useCallback(() => {
    Object.assign(g.current, { y: H / 2, vy: FLAP, pipes: [], score: 0, spawnIn: 0.6, startedAt: performance.now() });
    setScore(0);
    setPhase("running");
  }, []);

  const flap = useCallback(() => {
    if (phase === "running") g.current.vy = FLAP;
    else if (phase === "idle") start();
    else if (phase === "over" && performance.now() - g.current.overAt > 500) start();
  }, [phase, start]);

  useEffect(() => {
    if (phase !== "running") return;
    const s = g.current;
    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      s.vy += GRAVITY * dt;
      s.y += s.vy * dt;
      s.spawnIn -= dt;
      if (s.spawnIn <= 0) {
        s.spawnIn += PIPE_EVERY;
        const margin = 70;
        s.pipes.push({ x: W, gapY: margin + GAP / 2 + Math.random() * (H - GROUND - 2 * margin - GAP), passed: false });
      }
      for (const p of s.pipes) {
        p.x -= SPEED * dt;
        if (!p.passed && p.x + PIPE_W < BIRD_X - R) {
          p.passed = true;
          s.score += 1;
          setScore(s.score);
        }
      }
      s.pipes = s.pipes.filter((p) => p.x > -PIPE_W);
      const hitPipe = s.pipes.some(
        (p) =>
          BIRD_X + R - 3 > p.x &&
          BIRD_X - R + 3 < p.x + PIPE_W &&
          (s.y - R + 3 < p.gapY - GAP / 2 || s.y + R - 3 > p.gapY + GAP / 2),
      );
      if (hitPipe || s.y + R >= H - GROUND || s.y < -40) {
        draw();
        s.overAt = now;
        setWasBest(s.score > 0 && beats(s.score, best, "higher"));
        setPhase("over");
        onFinish(s.score, performance.now() - s.startedAt);
        return;
      }
      draw();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, draw, onFinish, best]);

  useKeys((e) => {
    if (e.key === " " || e.key === "ArrowUp" || e.key === "w" || (e.key === "Enter" && phase !== "running")) {
      e.preventDefault();
      flap();
    }
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <Stats items={[{ label: "Pipes", value: score }, { label: "Best", value: best ?? "—", accent: true }]} />
      <div
        className="touch-game relative w-full cursor-pointer"
        style={{ aspectRatio: `${W} / ${H}`, maxWidth: `min(${W}px, calc(72vh * ${W / H}))` }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          e.preventDefault();
          flap();
        }}
      >
        <canvas ref={canvasRef} className="h-full w-full rounded-2xl border border-line" aria-label="Flappy board. Press Space or tap to flap." />
        {phase === "idle" && (
          <Overlay>
            <p className="text-sm text-muted">Tap, click, or press Space to flap.</p>
            <button type="button" onClick={start} className={primaryButton}>
              Start
            </button>
          </Overlay>
        )}
        {phase === "over" && <GameOver score={`${score} pipes`} isBest={wasBest} onAgain={start} />}
      </div>
    </div>
  );
}

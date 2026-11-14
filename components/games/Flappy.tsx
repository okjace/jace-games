"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameOver, Overlay, Stats, beats, primaryButton, setupCanvas, useGameRandom, useKeys, type GameProps } from "./shared";
import { Fx, sfx } from "./fx";

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

export default function Flappy({ onFinish, best, seed, onProgress }: GameProps) {
  const rand = useGameRandom(seed);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"idle" | "running" | "over">("idle");
  const [score, setScore] = useState(0);
  const [wasBest, setWasBest] = useState(false);
  const g = useRef({ y: H / 2, vy: 0, pipes: [] as Pipe[], score: 0, spawnIn: 0, startedAt: 0, t: 0, overAt: 0, scroll: 0, flapAt: 0 });
  const fx = useRef(new Fx());

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const s = g.current;
    const now = performance.now();
    const f = fx.current;
    f.begin(ctx);
    // Sky, sun, and clouds and hills that drift by at different speeds.
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#38bdf8");
    sky.addColorStop(0.7, "#bae6fd");
    sky.addColorStop(1, "#fef3c7");
    ctx.fillStyle = sky;
    ctx.fillRect(-10, -10, W + 20, H + 20);
    ctx.fillStyle = "rgba(254,240,138,0.9)";
    ctx.beginPath();
    ctx.arc(W - 70, 90, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (let i = 0; i < 4; i++) {
      const x = ((i * 130 - s.scroll * 0.15) % (W + 120) + W + 120) % (W + 120) - 60;
      const y = 60 + (i % 2) * 70;
      for (const [dx, dy, r] of [
        [0, 0, 20],
        [18, -8, 16],
        [34, 0, 18],
        [16, 6, 16],
      ]) {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = "#86efac";
    ctx.beginPath();
    ctx.moveTo(0, H - GROUND);
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, H - GROUND - 40 - Math.sin((x + s.scroll * 0.4) / 50) * 18 - Math.sin((x + s.scroll * 0.4) / 23) * 6);
    ctx.lineTo(W, H - GROUND);
    ctx.fill();
    // Pipes: shaded tubes with rims.
    for (const p of s.pipes) {
      const tube = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
      tube.addColorStop(0, "#15803d");
      tube.addColorStop(0.35, "#4ade80");
      tube.addColorStop(1, "#166534");
      ctx.fillStyle = tube;
      const topH = p.gapY - GAP / 2;
      const botY = p.gapY + GAP / 2;
      ctx.fillRect(p.x + 4, -10, PIPE_W - 8, topH + 10);
      ctx.fillRect(p.x + 4, botY, PIPE_W - 8, H - GROUND - botY);
      ctx.beginPath();
      ctx.roundRect(p.x, topH - 22, PIPE_W, 22, 5);
      ctx.roundRect(p.x, botY, PIPE_W, 22, 5);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Ground with scrolling stripes.
    ctx.fillStyle = "#a16207";
    ctx.fillRect(0, H - GROUND, W, GROUND);
    ctx.fillStyle = "#65a30d";
    ctx.fillRect(0, H - GROUND, W, 8);
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    for (let x = -((s.scroll % 24) + 24); x < W; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, H - GROUND + 8);
      ctx.lineTo(x + 12, H - GROUND + 8);
      ctx.lineTo(x + 2, H);
      ctx.lineTo(x - 10, H);
      ctx.fill();
    }
    // The bird, with a wing that flaps.
    ctx.save();
    ctx.translate(BIRD_X, s.y);
    ctx.rotate(Math.max(-0.5, Math.min(1.2, s.vy / 600)));
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.ellipse(0, 0, R + 2, R, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fef9c3";
    ctx.beginPath();
    ctx.ellipse(-2, 4, R - 4, R - 7, 0, 0, Math.PI * 2);
    ctx.fill();
    const wing = Math.sin((now - s.flapAt) / 40) * (now - s.flapAt < 300 ? 1 : 0.3);
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.ellipse(-6, 1 + wing * 5, 8, 5, -0.4 + wing * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(6, -4, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(7.5, -4, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.moveTo(R - 1, 0);
    ctx.lineTo(R + 9, 3);
    ctx.lineTo(R - 1, 7);
    ctx.fill();
    ctx.restore();
    f.draw(ctx);
    // Score.
    if (s.pipes.length || s.score) {
      ctx.font = "900 46px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.strokeText(String(s.score), W / 2, 74);
      ctx.fillStyle = "#fff";
      ctx.fillText(String(s.score), W / 2, 74);
    }
  }, []);

  useEffect(() => {
    if (canvasRef.current) setupCanvas(canvasRef.current, W, H);
    draw();
    const obs = new MutationObserver(draw);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, [draw]);

  const start = useCallback(() => {
    rand.reset();
    Object.assign(g.current, { y: H / 2, vy: FLAP, pipes: [], score: 0, spawnIn: 0.6, startedAt: performance.now(), flapAt: performance.now() });
    fx.current.clear();
    setScore(0);
    setPhase("running");
  }, [rand]);

  const flap = useCallback(() => {
    if (phase === "running") {
      g.current.vy = FLAP;
      g.current.flapAt = performance.now();
      sfx.tap();
      fx.current.burst(BIRD_X - 8, g.current.y + 6, "rgba(255,255,255,0.8)", 4, 60, 0, 2);
    }
    else if (phase === "idle") start();
    else if (phase === "over" && seed === undefined && performance.now() - g.current.overAt > 500) start();
  }, [phase, start, seed]);

  useEffect(() => {
    if (phase !== "running") return;
    const s = g.current;
    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      s.vy += GRAVITY * dt;
      s.scroll += SPEED * dt;
      fx.current.update(dt);
      s.y += s.vy * dt;
      s.spawnIn -= dt;
      if (s.spawnIn <= 0) {
        s.spawnIn += PIPE_EVERY;
        const margin = 70;
        s.pipes.push({ x: W, gapY: margin + GAP / 2 + rand() * (H - GROUND - 2 * margin - GAP), passed: false });
      }
      for (const p of s.pipes) {
        p.x -= SPEED * dt;
        if (!p.passed && p.x + PIPE_W < BIRD_X - R) {
          p.passed = true;
          s.score += 1;
          setScore(s.score);
          sfx.coin();
          fx.current.float(BIRD_X + 20, s.y - 24, "+1", "#fff", 20);
          if (s.score % 10 === 0) fx.current.burst(BIRD_X, s.y, ["#facc15", "#f472b6", "#38bdf8"], 24, 200, 200);
          onProgress?.(s.score);
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
        // Crash: feathers, a jolt and a thud, and the effects play out.
        fx.current.shake(9, 0.35);
        fx.current.burst(BIRD_X, s.y, ["#facc15", "#f59e0b", "#fff"], 22, 220, 400, 3.5);
        sfx.boom();
        let last = now;
        const after = (t: number) => {
          fx.current.update(Math.min(0.05, (t - last) / 1000));
          last = t;
          draw();
          if (fx.current.busy) requestAnimationFrame(after);
        };
        requestAnimationFrame(after);
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
  }, [phase, draw, onFinish, best, onProgress, rand]);

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

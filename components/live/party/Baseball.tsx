"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { setupCanvas } from "@/components/games/shared";
import { useJuice } from "../fx/Juice";
import { sfx } from "../fx/sfx";
import type { StageProps } from "./index";

/**
 * Home Run Derby: every right answer (or tap) brings a pitch. Time your
 * swing as the ball reaches the plate. The server decides what your timing
 * earns (with a little luck), moves the runners and counts the runs.
 * Wrong answers are strikeouts; three outs end the inning.
 */

const W = 360;
const H = 300;
const WINDUP_MS = 900;

const PLAY_TEXT: Record<string, { text: string; color: string; good: boolean }> = {
  homer: { text: "HOME RUN!", color: "#facc15", good: true },
  triple: { text: "TRIPLE!", color: "#fb923c", good: true },
  double: { text: "DOUBLE!", color: "#4ade80", good: true },
  single: { text: "SINGLE!", color: "#38bdf8", good: true },
  flyout: { text: "Fly out", color: "#e2e8f0", good: false },
  groundout: { text: "Ground out", color: "#e2e8f0", good: false },
  strikeout: { text: "Strike out!", color: "#f87171", good: false },
  looking: { text: "Strike three, looking", color: "#f87171", good: false },
};

export function Baseball({ view, act, busy, earn }: StageProps) {
  const juice = useJuice();
  const ball = view.party.ball;
  const pitch = ball?.pitch ?? null;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const release = useRef(0);
  const swungAt = useRef<number | null>(null);
  const sent = useRef(false);
  const [banner, setBanner] = useState<{ play: string; runs: number; inningOver: boolean } | null>(null);

  const finish = useCallback(
    async (offset: number | null) => {
      if (sent.current) return;
      sent.current = true;
      const v = await act({ action: "swing", offset });
      const last = v?.last;
      if (!last || last.kind !== "play") return;
      const play = String(last.play);
      const runs = Number(last.runs) || 0;
      setBanner({ play, runs, inningOver: !!last.inningOver });
      if (play === "homer") {
        sfx.boom();
        setTimeout(() => sfx.levelUp(), 250);
        juice.confetti(140);
        juice.flash("rgba(250,204,21,0.4)");
      } else if (PLAY_TEXT[play]?.good) {
        sfx.boom();
        sfx.cash();
      } else {
        sfx.wrong();
        juice.shake();
      }
      if (runs > 0) juice.pop(`+${runs} run${runs === 1 ? "" : "s"}`, "#facc15");
    },
    [act, juice],
  );

  // A new pitch: wind up, throw, and draw the ball flying in.
  const pitchKey = pitch ? `${view.me.answered}-${pitch.type}-${pitch.ms}` : "";
  useEffect(() => {
    if (!pitch) return;
    sent.current = false;
    swungAt.current = null;
    release.current = performance.now() + WINDUP_MS;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = setupCanvas(canvas, W, H);
    let raf = 0;
    const draw = (t: number) => {
      drawField(ctx, t, release.current, pitch.ms, pitch.curve, swungAt.current);
      // Never swung: a called third strike shortly after the ball goes by.
      if (!sent.current && t > release.current + pitch.ms + 350) void finish(swungAt.current === null ? null : swungAt.current - (release.current + pitch.ms));
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
    // pitchKey identifies the pitch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitchKey]);

  const swing = useCallback(() => {
    if (!pitch || swungAt.current !== null || sent.current) return;
    const t = performance.now();
    if (t < release.current) return; // not thrown yet
    swungAt.current = t;
    sfx.whoosh();
    void finish(t - (release.current + pitch.ms));
  }, [pitch, finish]);

  useEffect(() => {
    if (!pitch) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        swing();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pitch, swing]);

  const field = ball && (
    <div className="flex items-center justify-between rounded-3xl bg-black/25 px-4 py-3 backdrop-blur">
      <MiniDiamond bases={ball.bases} />
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-white/70">Inning</p>
        <p className="text-2xl font-black">{ball.inning}</p>
      </div>
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-white/70">Outs</p>
        <p className="flex gap-1.5 pt-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`h-4 w-4 rounded-full border-2 border-white ${i < ball.outs ? "bg-red-500" : "bg-transparent"}`} />
          ))}
        </p>
      </div>
    </div>
  );

  if (banner) {
    const p = PLAY_TEXT[banner.play] ?? PLAY_TEXT.single;
    return (
      <div className="flex flex-col gap-3">
        {field}
        <div className="flex flex-col items-center gap-2 rounded-3xl bg-white/10 p-6 text-center backdrop-blur" style={{ animation: "jg-rise 0.25s ease-out" }}>
          <p className="text-4xl font-black drop-shadow" style={{ color: p.color, animation: "jg-zoom 1.2s ease-out forwards", animationFillMode: "both" }}>
            {p.text}
          </p>
          {banner.runs > 0 && <p className="text-xl font-black text-[#facc15]">+{banner.runs} run{banner.runs === 1 ? "" : "s"} scored!</p>}
          {banner.inningOver && <p className="font-bold text-white/80">Three outs: on to the next inning, bases cleared.</p>}
          <button type="button" autoFocus onClick={() => setBanner(null)} className="mt-2 h-12 rounded-full bg-white px-8 font-black text-green-800 shadow-[0_4px_0_rgba(0,0,0,0.25)] active:translate-y-1">
            Next batter
          </button>
        </div>
      </div>
    );
  }

  if (pitch) {
    return (
      <div className="flex flex-col gap-3">
        {field}
        <div className="relative overflow-hidden rounded-3xl border-4 border-white/30 shadow-xl">
          <canvas ref={canvasRef} onPointerDown={swing} className="touch-game block aspect-[6/5] w-full" aria-label="The pitch. Tap or press Space to swing." />
          <span className="absolute left-3 top-3 rounded-full bg-black/40 px-3 py-1 text-xs font-black uppercase tracking-widest">{pitch.type}</span>
        </div>
        <button
          type="button"
          disabled={busy}
          onPointerDown={(e) => {
            e.preventDefault();
            swing();
          }}
          className="h-20 rounded-3xl bg-[#facc15] text-3xl font-black text-[#14532d] shadow-[0_8px_0_rgba(0,0,0,0.3)] active:translate-y-2 active:shadow-[0_2px_0_rgba(0,0,0,0.3)]"
        >
          SWING!
        </button>
        <p className="text-center text-sm font-semibold text-white/80">Swing when the ball reaches the plate. Space works too.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {field}
      {earn}
    </div>
  );
}

function MiniDiamond({ bases }: { bases: [boolean, boolean, boolean] }) {
  const base = (on: boolean) => `h-4 w-4 rotate-45 border-2 border-white ${on ? "bg-[#facc15]" : "bg-transparent"}`;
  return (
    <div className="relative h-14 w-14" aria-label={`Runners on: ${bases.map((b, i) => (b ? ["first", "second", "third"][i] : null)).filter(Boolean).join(", ") || "nobody"}`}>
      <span className={`absolute left-1/2 top-0 -translate-x-1/2 ${base(bases[1])}`} />
      <span className={`absolute right-0 top-1/2 -translate-y-1/2 ${base(bases[0])}`} />
      <span className={`absolute left-0 top-1/2 -translate-y-1/2 ${base(bases[2])}`} />
      <span className="absolute bottom-0 left-1/2 h-3 w-3 -translate-x-1/2 bg-white" />
    </div>
  );
}

/** The ballpark from behind the plate: pitcher, ball, and the bat. */
function drawField(ctx: CanvasRenderingContext2D, t: number, release: number, ms: number, curve: number, swungAt: number | null) {
  // Sky and stands.
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.35);
  sky.addColorStop(0, "#1e3a8a");
  sky.addColorStop(1, "#60a5fa");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#334155";
  ctx.fillRect(0, H * 0.22, W, H * 0.12);
  for (let x = 6; x < W; x += 12) {
    ctx.fillStyle = ["#f87171", "#facc15", "#38bdf8", "#e2e8f0"][(x / 12) % 4 | 0];
    ctx.beginPath();
    ctx.arc(x, H * 0.26 + Math.sin(x + t / 300) * 1.5, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Grass with mowing stripes, and the infield dirt.
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? "#15803d" : "#16a34a";
    ctx.fillRect(0, H * 0.34 + i * ((H * 0.66) / 8), W, (H * 0.66) / 8 + 1);
  }
  ctx.fillStyle = "#b45309";
  ctx.beginPath();
  ctx.moveTo(W / 2, H * 0.38);
  ctx.lineTo(W * 0.92, H * 0.75);
  ctx.lineTo(W / 2, H * 1.05);
  ctx.lineTo(W * 0.08, H * 0.75);
  ctx.closePath();
  ctx.fill();
  // Mound and pitcher (a simple figure in team colours).
  const mx = W / 2;
  const my = H * 0.5;
  ctx.fillStyle = "#92400e";
  ctx.beginPath();
  ctx.ellipse(mx, my + 14, 26, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  const windup = Math.max(0, Math.min(1, 1 - (release - t) / WINDUP_MS));
  const throwing = t >= release && t < release + 250;
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(mx - 7, my - 18, 14, 22); // body
  ctx.fillStyle = "#1d4ed8";
  ctx.fillRect(mx - 8, my - 22, 16, 6); // cap brim
  ctx.fillStyle = "#fcd34d";
  ctx.beginPath();
  ctx.arc(mx, my - 26, 6, 0, Math.PI * 2); // head
  ctx.fill();
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(mx + 6, my - 14);
  const armAngle = throwing ? -0.4 : -2.2 * windup;
  ctx.lineTo(mx + 6 + Math.cos(armAngle) * 16, my - 14 + Math.sin(armAngle) * 16);
  ctx.stroke();
  // Home plate.
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(W / 2 - 18, H * 0.9);
  ctx.lineTo(W / 2 + 18, H * 0.9);
  ctx.lineTo(W / 2 + 18, H * 0.93);
  ctx.lineTo(W / 2, H * 0.97);
  ctx.lineTo(W / 2 - 18, H * 0.93);
  ctx.closePath();
  ctx.fill();
  // The ball: grows as it comes in, and breaking pitches drift sideways.
  const p = (t - release) / ms;
  if (p >= 0 && p < 1.25) {
    const e = Math.min(p, 1.25);
    const x = mx + curve * Math.sin(Math.min(1, e) * Math.PI * 0.9) + (e > 1 ? (e - 1) * 60 : 0);
    const y = my - 10 + (H * 0.88 - (my - 10)) * Math.min(1, e) + (e > 1 ? (e - 1) * 120 : 0);
    const r = 3 + 11 * Math.min(1, e) ** 2;
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(x, Math.max(y + r, H * 0.88), r, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = Math.max(1, r / 6);
    ctx.beginPath();
    ctx.arc(x - r * 0.5, y, r * 0.6, -0.9, 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + r * 0.5, y, r * 0.6, Math.PI - 0.9, Math.PI + 0.9);
    ctx.stroke();
  }
  // The bat: ready, or swinging through.
  const sw = swungAt === null ? 0 : Math.min(1, (t - swungAt) / 160);
  ctx.save();
  ctx.translate(W * 0.68, H * 0.98);
  ctx.rotate(-2.3 + sw * 2.6);
  ctx.fillStyle = "#d6a35c";
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.lineTo(110, -9);
  ctx.quadraticCurveTo(122, 0, 110, 9);
  ctx.lineTo(0, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

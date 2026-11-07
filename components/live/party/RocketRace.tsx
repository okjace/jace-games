"use client";

import { useEffect, useRef } from "react";
import { setupCanvas } from "@/components/games/shared";
import type { StageProps } from "./index";

/**
 * Rocket Race: right answers (or boosts) push your rocket toward the
 * finish planet. The race track shows the top racers flying side by side.
 */

const W = 480;
const H = 260;

export function RocketRace({ view, earn }: StageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const racers = useRef<{ name: string; score: number; you: boolean; shown: number }[]>([]);

  // Ease each rocket toward its latest progress.
  useEffect(() => {
    const prev = new Map(racers.current.map((r) => [r.name, r.shown]));
    racers.current = view.top.map((p) => ({ ...p, shown: prev.get(p.name) ?? p.score }));
  }, [view.top]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = setupCanvas(canvas, W, H);
    const stars = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.6 + 0.3, v: Math.random() * 0.6 + 0.2 }));
    let raf = 0;
    const COLORS = ["#f87171", "#facc15", "#38bdf8", "#a78bfa", "#4ade80"];
    const draw = (t: number) => {
      ctx.fillStyle = "#05060f";
      ctx.fillRect(0, 0, W, H);
      for (const s of stars) {
        s.x -= s.v;
        if (s.x < 0) s.x = W;
        ctx.fillStyle = `rgba(255,255,255,${0.4 + s.s / 3})`;
        ctx.fillRect(s.x, s.y, s.s, s.s);
      }
      // Finish planet.
      const g = ctx.createRadialGradient(W - 30, H / 2, 10, W - 30, H / 2, 70);
      g.addColorStop(0, "#fde68a");
      g.addColorStop(1, "#b45309");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(W + 10, H / 2, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(W - 70, 8);
      ctx.lineTo(W - 70, H - 8);
      ctx.stroke();
      ctx.setLineDash([]);
      const list = racers.current;
      const lane = H / Math.max(1, list.length);
      list.forEach((r, i) => {
        r.shown += (r.score - r.shown) * 0.08;
        const x = 30 + (W - 120) * Math.min(1, r.shown / 100);
        const y = lane * i + lane / 2;
        // Flame trail.
        const flick = 6 + Math.sin(t / 40 + i) * 3;
        ctx.fillStyle = "#fb923c";
        ctx.beginPath();
        ctx.moveTo(x - 14, y - 5);
        ctx.lineTo(x - 14 - flick * 2, y);
        ctx.lineTo(x - 14, y + 5);
        ctx.fill();
        ctx.fillStyle = "#fde047";
        ctx.beginPath();
        ctx.moveTo(x - 14, y - 3);
        ctx.lineTo(x - 14 - flick, y);
        ctx.lineTo(x - 14, y + 3);
        ctx.fill();
        // Body.
        ctx.fillStyle = r.you ? "#ffffff" : COLORS[i % COLORS.length];
        ctx.beginPath();
        ctx.moveTo(x + 16, y);
        ctx.quadraticCurveTo(x + 6, y - 10, x - 14, y - 8);
        ctx.lineTo(x - 14, y + 8);
        ctx.quadraticCurveTo(x + 6, y + 10, x + 16, y);
        ctx.fill();
        ctx.fillStyle = "#0ea5e9";
        ctx.beginPath();
        ctx.arc(x + 2, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = r.you ? "#facc15" : "rgba(255,255,255,0.85)";
        ctx.font = `${r.you ? "bold " : ""}12px sans-serif`;
        ctx.textAlign = "left";
        ctx.fillText(`${r.name}${r.you ? " (you)" : ""} · ${Math.round(r.score)}%`, Math.min(x + 22, W - 160), y + 4);
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <canvas ref={canvasRef} className="block aspect-[24/13] w-full rounded-3xl border-4 border-white/20 shadow-xl" aria-label="The race" />
      <div className="h-3 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-fuchsia-400 transition-[width] duration-500" style={{ width: `${view.me.score}%` }} />
      </div>
      {earn}
    </div>
  );
}

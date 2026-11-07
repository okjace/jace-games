"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { setupCanvas } from "@/components/games/shared";
import type { PlayerView } from "@/lib/live/engine";
import { useJuice } from "../fx/Juice";
import { sfx } from "../fx/sfx";
import type { StageProps } from "./index";

/**
 * Home Run Derby: every right answer (or tap) starts an at-bat. Time your
 * swing as the ball crosses the glowing ring at the plate. Misses and fouls
 * are strikes and bring another pitch; three strikes is an out. The server
 * decides what your timing earns (with a little luck) and counts the runs.
 * After each swing the ball flies off the bat before the result shows.
 */

const W = 360;
const H = 300;
const WINDUP_MS = 900;
/** How long the batted ball flies before the result shows. */
const FLIGHT_MS = 1100;
const PLATE: [number, number] = [W / 2, H * 0.86];

type ViewPitch = NonNullable<NonNullable<PlayerView["party"]["ball"]>["pitch"]>;
type Contact = { play: string; at: number; offset: number | null };

const PLAY_TEXT: Record<string, { text: string; color: string; good: boolean }> = {
  homer: { text: "HOME RUN!", color: "#facc15", good: true },
  triple: { text: "TRIPLE!", color: "#fb923c", good: true },
  double: { text: "DOUBLE!", color: "#4ade80", good: true },
  single: { text: "SINGLE!", color: "#38bdf8", good: true },
  flyout: { text: "Fly out", color: "#e2e8f0", good: false },
  groundout: { text: "Ground out", color: "#e2e8f0", good: false },
  strikeout: { text: "Strike three!", color: "#f87171", good: false },
  looking: { text: "Strike three, looking", color: "#f87171", good: false },
};

/** "PERFECT!", "A bit early"… from how far off the swing was. */
function timingText(offset: number | null): { text: string; color: string } | null {
  if (offset === null) return null;
  const off = Math.abs(offset);
  if (off <= 45) return { text: "PERFECT!", color: "#facc15" };
  if (off <= 95) return { text: "Great timing!", color: "#4ade80" };
  const side = offset < 0 ? "early" : "late";
  if (off <= 155) return { text: `A bit ${side}`, color: "#e2e8f0" };
  return { text: `Way ${side}!`, color: "#f87171" };
}

export function Baseball({ view, act, earn }: StageProps) {
  const juice = useJuice();
  const ball = view.party.ball;
  const pitch = ball?.pitch ?? null;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const release = useRef(0);
  const swungAt = useRef<number | null>(null);
  const contact = useRef<Contact | null>(null);
  const sent = useRef(false);
  // The pitch on screen. It stays up while the batted ball flies, even after the server has moved on.
  const [shown, setShown] = useState<ViewPitch | null>(null);
  const [banner, setBanner] = useState<{ play: string; runs: number; inningOver: boolean } | null>(null);
  const [callout, setCallout] = useState<{ text: string; color: string; id: number } | null>(null);
  const [flying, setFlying] = useState(false);

  // A new at-bat from answering: show its first pitch.
  if (pitch && !shown && !banner && !flying) setShown(pitch);

  const finish = useCallback(
    async (offset: number | null) => {
      if (sent.current) return;
      sent.current = true;
      setFlying(true);
      const v = await act({ action: "swing", offset });
      const last = v?.last;
      if (!v || !last || last.kind !== "play") {
        sent.current = false;
        setFlying(false);
        setShown(null);
        return;
      }
      const play = String(last.play);
      const hitType = String(last.contact ?? play);
      contact.current = { play: hitType, at: performance.now(), offset };
      const runs = Number(last.runs) || 0;
      const timing = timingText(offset);
      if (hitType === "foul" || hitType === "miss" || hitType === "looking") {
        if (hitType === "foul") sfx.tap();
        else sfx.wrong();
        const strikes = Number(last.strikes) || 0;
        const strikeText = last.atBatOver ? null : hitType === "foul" ? `Foul ball! ${strikes} strike${strikes === 1 ? "" : "s"}` : `Strike ${strikes}!`;
        setCallout({ text: [timing?.text, strikeText].filter(Boolean).join(" · ") || "Strike!", color: timing?.color ?? "#f87171", id: Date.now() });
      } else {
        if (timing) setCallout({ ...timing, id: Date.now() });
        sfx.boom();
      }
      // Let the ball fly, then either pitch again (same at-bat) or show what happened.
      setTimeout(() => {
        contact.current = null;
        swungAt.current = null;
        sent.current = false;
        setFlying(false);
        const next = v.party.ball?.pitch ?? null;
        if (next && !last.atBatOver) {
          setShown(next);
          return;
        }
        setShown(null);
        setBanner({ play, runs, inningOver: !!last.inningOver });
        if (play === "homer") {
          setTimeout(() => sfx.levelUp(), 100);
          juice.confetti(140);
          juice.flash("rgba(250,204,21,0.4)");
        } else if (PLAY_TEXT[play]?.good) sfx.cash();
        else juice.shake();
        if (runs > 0) juice.pop(`+${runs} run${runs === 1 ? "" : "s"}`, "#facc15");
      }, FLIGHT_MS);
    },
    [act, juice],
  );

  // Each pitch: wind up, throw, fly in, and (after a swing) fly off the bat.
  const pitchId = shown?.id ?? 0;
  useEffect(() => {
    if (!shown) return;
    swungAt.current = null;
    contact.current = null;
    release.current = performance.now() + WINDUP_MS;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = setupCanvas(canvas, W, H);
    let raf = 0;
    const draw = (t: number) => {
      drawField(ctx, t, release.current, shown, swungAt.current, contact.current);
      // Never swung: the pitch is taken for a strike shortly after it goes by.
      if (!sent.current && swungAt.current === null && t > release.current + shown.ms + 350) void finish(null);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
    // pitchId identifies the pitch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitchId]);

  const swing = useCallback(() => {
    if (!shown || swungAt.current !== null || sent.current) return;
    const t = performance.now();
    if (t < release.current) {
      setCallout({ text: "Wait for the throw!", color: "#e2e8f0", id: Date.now() });
      return;
    }
    swungAt.current = t;
    sfx.whoosh();
    void finish(t - (release.current + shown.ms));
  }, [shown, finish]);

  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        swing();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, swing]);

  useEffect(() => {
    if (!callout) return;
    const t = setTimeout(() => setCallout(null), 1300);
    return () => clearTimeout(t);
  }, [callout]);

  const field = ball && (
    <div className="flex items-center justify-between rounded-3xl bg-black/25 px-4 py-3 backdrop-blur">
      <MiniDiamond bases={ball.bases} />
      <Count label="Inning" value={<span className="text-2xl font-black">{ball.inning}</span>} />
      <Count label="Strikes" value={<Dots n={ball.strikes ?? 0} of={2} color="bg-amber-400" />} />
      <Count label="Outs" value={<Dots n={ball.outs} of={3} color="bg-red-500" />} />
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

  if (shown) {
    return (
      <div className="flex flex-col gap-3">
        {field}
        <div className="relative overflow-hidden rounded-3xl border-4 border-white/30 shadow-xl">
          <canvas
            ref={canvasRef}
            onPointerDown={(e) => {
              e.preventDefault();
              swing();
            }}
            className="touch-game block aspect-[6/5] w-full"
            aria-label="The pitch. Tap anywhere or press Space to swing."
          />
          <span className="absolute left-3 top-3 rounded-full bg-black/40 px-3 py-1 text-xs font-black uppercase tracking-widest">{shown.type}</span>
          {callout && (
            <span
              key={callout.id}
              className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-3xl font-black drop-shadow-[0_3px_0_rgba(0,0,0,0.5)]"
              style={{ color: callout.color, animation: "jg-pop-up 1.3s ease-out forwards" }}
            >
              {callout.text}
            </span>
          )}
        </div>
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            swing();
          }}
          className="h-20 rounded-3xl bg-[#facc15] text-3xl font-black text-[#14532d] shadow-[0_8px_0_rgba(0,0,0,0.3)] active:translate-y-2 active:shadow-[0_2px_0_rgba(0,0,0,0.3)]"
        >
          SWING!
        </button>
        <p className="text-center text-sm font-semibold text-white/80">Swing as the ball hits the glowing ring. Tap the field, the button, or press Space.</p>
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

function Count({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-white/70">{label}</p>
      <div className="flex h-8 items-center justify-center">{value}</div>
    </div>
  );
}

function Dots({ n, of, color }: { n: number; of: number; color: string }) {
  return (
    <span className="flex gap-1.5">
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={`h-4 w-4 rounded-full border-2 border-white ${i < n ? color : "bg-transparent"}`} />
      ))}
    </span>
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

/** Where a batted ball goes: [x, y, arc height], from behind the plate. */
const FLIGHT: Record<string, [number, number, number]> = {
  homer: [W * 0.5, -40, 200],
  triple: [W * 0.9, H * 0.3, 120],
  double: [W * 0.12, H * 0.33, 100],
  single: [W * 0.62, H * 0.42, 20],
  groundout: [W * 0.38, H * 0.5, 0],
  flyout: [W * 0.55, H * 0.38, 230],
  foul: [W * 1.1, H * 0.15, 140],
};

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
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

/** The ballpark from behind the plate: pitcher, the ball, the ring to swing at, and the bat. */
function drawField(ctx: CanvasRenderingContext2D, t: number, release: number, pitch: ViewPitch, swungAt: number | null, contact: Contact | null) {
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.35);
  sky.addColorStop(0, "#1e3a8a");
  sky.addColorStop(1, "#60a5fa");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#334155";
  ctx.fillRect(0, H * 0.22, W, H * 0.12);
  const cheer = contact && contact.play !== "miss" && contact.play !== "looking" ? 4 : 1.5;
  for (let x = 6; x < W; x += 12) {
    ctx.fillStyle = ["#f87171", "#facc15", "#38bdf8", "#e2e8f0"][(x / 12) % 4 | 0];
    ctx.beginPath();
    ctx.arc(x, H * 0.26 + Math.sin(x + t / (cheer > 2 ? 90 : 300)) * cheer, 3, 0, Math.PI * 2);
    ctx.fill();
  }
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

  // Pitcher.
  const mx = W / 2;
  const my = H * 0.5;
  ctx.fillStyle = "#92400e";
  ctx.beginPath();
  ctx.ellipse(mx, my + 14, 26, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  const windup = Math.max(0, Math.min(1, 1 - (release - t) / WINDUP_MS));
  const throwing = t >= release && t < release + 250;
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(mx - 7, my - 18, 14, 22);
  ctx.fillStyle = "#1d4ed8";
  ctx.fillRect(mx - 8, my - 22, 16, 6);
  ctx.fillStyle = "#fcd34d";
  ctx.beginPath();
  ctx.arc(mx, my - 26, 6, 0, Math.PI * 2);
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

  const p = (t - release) / pitch.ms;
  // The ring to swing at: it glows brighter as the ball gets close, and the ball meets it at the perfect moment.
  if (!contact) {
    const near = p > 0 ? Math.max(0, 1 - Math.abs(1 - p) * 2.5) : 0;
    const ringX = PLATE[0] + pitch.curve * Math.sin(Math.PI * 0.9);
    ctx.strokeStyle = `rgba(250,204,21,${0.35 + near * 0.65})`;
    ctx.lineWidth = 3 + near * 3;
    ctx.beginPath();
    ctx.arc(ringX, PLATE[1], 16 + (1 - near) * 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  // The ball.
  const curveX = (e: number) => mx + pitch.curve * Math.sin(Math.min(1, e) * Math.PI * 0.9);
  if (contact && contact.play !== "miss" && contact.play !== "looking") {
    // Off the bat: from the plate toward where the play goes, rising and shrinking with distance.
    const k = Math.min(1, (t - contact.at) / (FLIGHT_MS * 0.85));
    const [tx, ty, arc] = FLIGHT[contact.play] ?? FLIGHT.single;
    const sx = curveX(1);
    const x = sx + (tx - sx) * k;
    const y = PLATE[1] + (ty - PLATE[1]) * k - Math.sin(k * Math.PI) * arc * (contact.play === "homer" ? 0.4 : 1) * 0.5;
    const r = Math.max(2, 12 * (1 - k * 0.8));
    if (contact.play === "homer" && k > 0.5) {
      // Fireworks over the stands.
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const d = (k - 0.5) * 120;
        ctx.fillStyle = ["#facc15", "#f87171", "#38bdf8"][i % 3];
        ctx.beginPath();
        ctx.arc(W / 2 + Math.cos(a) * d, H * 0.15 + Math.sin(a) * d, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(x, PLATE[1] + (ty - PLATE[1]) * k + 6, r, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    drawBall(ctx, x, y, r);
  } else if (p >= 0 && p < 1.4) {
    const e = Math.min(p, 1.4);
    const x = curveX(e) + (e > 1 ? (e - 1) * 30 : 0);
    const y = my - 10 + (PLATE[1] - (my - 10)) * Math.min(1, e) + (e > 1 ? (e - 1) * 140 : 0);
    const r = 3 + 9 * Math.min(1, e) ** 2;
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(x, Math.max(y + r, H * 0.88), r, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    drawBall(ctx, x, y, r);
  }

  // Bat: ready, or swinging through.
  const sw = swungAt === null ? 0 : Math.min(1, (t - swungAt) / 140);
  ctx.save();
  ctx.translate(W * 0.66, H * 0.97);
  ctx.rotate(-2.4 + sw * 2.9);
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

"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { SEASONS, type Motion, type SeasonId } from "@/lib/seasons";
import { currentCustom } from "@/lib/customThemes";
import { popSound } from "./SeasonFx";
import { onPrefsLoaded, pushPrefs } from "./ThemeContext";

/**
 * The site theme's decorations: things drifting across the whole page
 * (leaves in fall, snow at Christmas…) on a layer that never blocks clicks,
 * and a garland under the menu bar. Each viewer can switch the moving
 * decorations off (remembered on their device); people who ask their system
 * for less motion don't get them at all.
 */

const KEY = "jace-live:effects-off";
const subs = new Set<() => void>();
function readOff(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
function setOff(off: boolean) {
  try {
    localStorage.setItem(KEY, off ? "1" : "0");
  } catch {}
  subs.forEach((f) => f());
  pushPrefs();
}
function useEffectsOff(): boolean {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      // Settings from ur account can change it too.
      const off = onPrefsLoaded(f);
      return () => {
        subs.delete(f);
        off();
      };
    },
    readOff,
    () => false,
  );
}

type P = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; size: number; phase: number; sprite: HTMLCanvasElement; alpha: number };

/** Emoji drawn once onto little canvases, so hundreds of frames are cheap. Plain symbols (❅ ✦) take `color`. */
function sprite(ch: string, px: number, color: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = px * 2;
  const ctx = c.getContext("2d")!;
  ctx.font = `${px * 1.4}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(ch, px, px * 1.08);
  return c;
}

function spawn(motion: Motion, w: number, h: number, sprites: HTMLCanvasElement[], anywhere: boolean, scale = 1, speed = 1): P {
  const size = (motion === "snow" ? 10 + Math.random() * 14 : 16 + Math.random() * 18) * scale;
  const p: P = {
    x: Math.random() * w,
    y: anywhere ? Math.random() * h : motion === "rise" ? h + 30 : -30,
    vx: (Math.random() - 0.5) * 20,
    vy: 0,
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 1.6,
    size,
    phase: Math.random() * Math.PI * 2,
    sprite: sprites[Math.floor(Math.random() * sprites.length)],
    alpha: 0.55 + Math.random() * 0.4,
  };
  if (motion === "fall") p.vy = 28 + Math.random() * 40;
  else if (motion === "snow") p.vy = 22 + Math.random() * 30;
  else if (motion === "rise") p.vy = -(20 + Math.random() * 30);
  else if (motion === "drift") {
    p.vy = 8 + Math.random() * 14;
    p.vx = (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 24);
  } else p.vy = 4 + Math.random() * 6;
  p.vx *= speed;
  p.vy *= speed;
  p.vr *= speed;
  return p;
}

/** A popped Christmas present: the server decides if there's a prize inside. */
async function openPresent() {
  const res = await fetch("/api/live/gift", { method: "POST" }).catch(() => null);
  const body = (await res?.json().catch(() => null)) as { won?: boolean; signIn?: boolean; prize?: { kind: "xp" | "pick"; amount?: number } } | null;
  const egg = (detail: Record<string, unknown>) => window.dispatchEvent(new CustomEvent("jl-egg", { detail }));
  if (body?.signIn) return egg({ say: "psst 🎁 sign in n presents can have prizes inside!!" });
  if (!body?.won || !body.prize) return;
  if (body.prize.kind === "xp") egg({ shout: `🎁 +${body.prize.amount} XP!!`, big: true, party: ["🎁", "⭐", "🎄"] });
  else egg({ shout: "🎁 FREE PICK!! unlock anything in ur locker", big: true, party: ["🎁", "🎉", "✨"] });
}

export function SeasonalSky({ season, boost = 1 }: { season: SeasonId; boost?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const off = useEffectsOff();
  const s = SEASONS[season];
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || off || !s.particles.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d")!;
    // A custom theme can make them bigger/smaller and faster/slower.
    const custom = (season as string) === "custom" ? currentCustom() : null;
    const scale = custom?.particleSize ?? 1;
    const speed = custom?.particleSpeed ?? 1;
    const make = (anywhere: boolean) => spawn(s.motion, w, h, sprites, anywhere, scale, speed);
    // Plain symbols take the theme's colours (white would vanish on the light page).
    const css = getComputedStyle(document.documentElement);
    const tint = [css.getPropertyValue("--accent").trim() || "#38bdf8", css.getPropertyValue("--accent2").trim() || "#a5b4fc"];
    const sprites = s.particles.map((ch, i) => sprite(ch, 24, s.motion === "snow" ? "#7cc4ea" : tint[i % 2]));
    // Which emoji each sprite is (presents can hold prizes).
    const charOf = new Map(sprites.map((sp, i) => [sp, s.particles[i]]));
    let w = 0;
    let h = 0;
    let parts: P[] = [];
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // About `density` on a big screen, fewer on small ones.
      const want = Math.round((s.density * Math.min(1, (w * h) / (1440 * 900)) + s.density * 0.3) * boost);
      while (parts.length < want) parts.push(make(true));
      parts = parts.slice(0, want);
    };
    resize();
    window.addEventListener("resize", resize);
    // Click a falling thing to pop it (the click still goes through to the page).
    const bits: { x: number; y: number; vx: number; vy: number; life: number; sprite: HTMLCanvasElement }[] = [];
    const onDown = (e: PointerEvent) => {
      const i = parts.findIndex((p) => Math.hypot(p.x - e.clientX, p.y - e.clientY) < p.size * 0.9 + 6);
      if (i < 0) return;
      const p = parts[i];
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        bits.push({ x: p.x, y: p.y, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140 - 60, life: 1, sprite: p.sprite });
      }
      parts[i] = make(false);
      popSound(season);
      if (charOf.get(p.sprite) === "🎁") void openPresent();
    };
    window.addEventListener("pointerdown", onDown);
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        p.phase += dt;
        if (s.motion === "twinkle") {
          p.alpha = 0.35 + Math.abs(Math.sin(p.phase * 1.4)) * 0.6;
          p.y += p.vy * dt;
        } else {
          // Sway side to side as they go.
          p.x += (p.vx + Math.sin(p.phase * 1.3) * (s.motion === "snow" ? 14 : 28)) * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
        }
        const gone = p.y > h + 40 || p.y < -50 || p.x < -60 || p.x > w + 60;
        if (gone) parts[i] = make(false);
        ctx.globalAlpha = p.alpha;
        ctx.save();
        ctx.translate(p.x, p.y);
        if (s.motion !== "twinkle") ctx.rotate(Math.sin(p.rot) * 0.9);
        ctx.drawImage(p.sprite, -p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
      // Popped pieces.
      for (const b of bits) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.vy += 400 * dt;
        b.life -= dt * 1.8;
        if (b.life <= 0) continue;
        ctx.globalAlpha = b.life;
        ctx.drawImage(b.sprite, b.x - 7, b.y - 7, 14, 14);
      }
      for (let i = bits.length - 1; i >= 0; i--) if (bits[i].life <= 0) bits.splice(i, 1);
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    const visibility = () => {
      cancelAnimationFrame(raf);
      if (document.visibilityState === "visible") {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    raf = requestAnimationFrame(frame);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointerdown", onDown);
      document.removeEventListener("visibilitychange", visibility);
      ctx.clearRect(0, 0, w, h);
    };
  }, [s, off, season, boost]);
  if (!s.particles.length) return null;
  return <canvas ref={ref} aria-hidden="true" className="jl-sky pointer-events-none fixed inset-0 z-30 h-screen w-screen" />;
}

/** The row of emoji under the menu bar. */
export function Garland({ season }: { season: SeasonId }) {
  const g = SEASONS[season].garland;
  if (!g) return null;
  return (
    <div aria-hidden="true" data-egg="garland" className="cursor-pointer select-none overflow-hidden whitespace-nowrap border-b border-line/60 bg-background/40 py-0.5 text-center text-sm leading-6 tracking-[0.35em]">
      <span className="jl-garland inline-block">{g.repeat(4)}</span>
    </div>
  );
}

/** Switch the moving decorations on or off on this device. */
export function EffectsToggle({ season }: { season: SeasonId }) {
  const off = useEffectsOff();
  const s = SEASONS[season];
  if (!s.particles.length) return null;
  return (
    <button
      type="button"
      onClick={() => setOff(!off)}
      aria-pressed={!off}
      title={off ? `Turn the ${s.name.toLowerCase()} effects on` : `Turn the ${s.name.toLowerCase()} effects off`}
      aria-label={off ? `Turn the ${s.name} effects on` : `Turn the ${s.name} effects off`}
      className={`flex h-9 w-9 items-center justify-center rounded-full text-lg transition-colors hover:bg-foreground/[.06] ${off ? "opacity-40 grayscale" : ""}`}
    >
      {s.icon}
    </button>
  );
}

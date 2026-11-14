"use client";

import { useEffect, useRef, useState } from "react";
import { getAudio, setAudio, useAudio } from "@/lib/audioSettings";
import { SEASONS, SEASON_FX, type ClickSound, type SeasonId } from "@/lib/seasons";

/**
 * The loud part of the site theme: a themed background (colour wash, a
 * drifting emoji pattern, hills with things standing on them), big things
 * flying across now and then, sparkles following the pointer, a little
 * sound on every click, and an optional theme tune. All of it skips people
 * who ask their system for less motion, and the sound button in the menu
 * bar turns sounds and the tune on or off (remembered on this device).
 */

// Volume comes from the Sound effects slider (lib/audioSettings).
const useSound = () => (useAudio().sfx > 0 ? "on" : "off");

// ---------- Synth ----------

let ac: AudioContext | null = null;
function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ac ??= new AudioContext();
    if (ac.state === "suspended") void ac.resume();
    return ac;
  } catch {
    return null;
  }
}
function note(f: number, d: number, type: OscillatorType = "triangle", v = 0.08, when = 0, slide?: number) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v * getAudio().sfx), t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + d + 0.05);
}
function noise(d: number, v: number, freq: number, type: BiquadFilterType = "bandpass", when = 0) {
  const a = audio();
  if (!a) return;
  const buf = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * d)), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
  const src = a.createBufferSource();
  const f = a.createBiquadFilter();
  const g = a.createGain();
  src.buffer = buf;
  f.type = type;
  f.frequency.value = freq;
  g.gain.value = v * getAudio().sfx;
  src.connect(f).connect(g).connect(a.destination);
  src.start(a.currentTime + when);
}

/** The click sound for a theme (a few random variations so it never gets samey). */
function clickSound(kind: ClickSound) {
  const r = 0.9 + Math.random() * 0.25;
  switch (kind) {
    case "crunch":
      noise(0.09, 0.35, 1800 * r);
      noise(0.07, 0.25, 3200 * r, "bandpass", 0.04);
      break;
    case "jingle":
      [1318.5, 1567.98, 1760].forEach((f, i) => note(f * r, 0.35, "sine", 0.05, i * 0.03));
      noise(0.05, 0.08, 7000, "highpass");
      break;
    case "spooky":
      note(220 * r, 0.45, "sine", 0.07, 0, 0.5);
      note(233 * r, 0.45, "sine", 0.05, 0.02, 0.48);
      break;
    case "chime":
      [523.25, 659.25, 783.99].forEach((f, i) => note(f * r, 0.25, "triangle", 0.06, i * 0.05));
      break;
    case "splash":
      noise(0.25, 0.2, 900 * r, "lowpass");
      note(500 * r, 0.12, "sine", 0.05, 0, 1.8);
      break;
    case "zap":
      note(300 * r, 0.14, "square", 0.04, 0, 3);
      break;
    case "boing":
      note(180 * r, 0.3, "sine", 0.09, 0, 2.6);
      break;
    default:
      note(660 * r, 0.08, "sine", 0.08, 0, 1.6);
  }
}

// ---------- Pieces ----------

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** An SVG tile of the theme's emoji for the drifting background pattern. */
function patternUrl(chars: string[]): string {
  const cells = chars.slice(0, 4);
  const pos = [
    [30, 40, -15],
    [110, 25, 20],
    [70, 105, 8],
    [150, 120, -25],
  ];
  const text = cells.map((c, i) => `<text x='${pos[i][0]}' y='${pos[i][1]}' font-size='26' transform='rotate(${pos[i][2]} ${pos[i][0]} ${pos[i][1]})'>${c}</text>`).join("");
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='180' height='150'>${text}</svg>`)}")`;
}

export function SeasonBackdrop({ season }: { season: SeasonId }) {
  const s = SEASONS[season];
  const fx = SEASON_FX[season];
  const sound = useSound();
  const [flyby, setFlyby] = useState<{ id: number; y: number; dir: 1 | -1; size: number } | null>(null);
  const trailRef = useRef<HTMLCanvasElement>(null);

  // Clicks make the theme's sound.
  useEffect(() => {
    if (season === "plain" || sound === "off") return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("a,button,[role=button],input[type=checkbox],select,summary")) clickSound(fx.click);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [season, sound, fx.click]);

  // Now and then something big crosses the screen.
  useEffect(() => {
    if (!fx.flyby || reduced()) return;
    let timer: ReturnType<typeof setTimeout>;
    const next = (wait: number) => {
      timer = setTimeout(() => {
        if (document.visibilityState === "visible") {
          setFlyby({ id: Date.now(), y: fx.flybyPath === "ground" ? 0 : 12 + Math.random() * 45, dir: Math.random() < 0.5 ? 1 : -1, size: 48 + Math.random() * 30 });
        }
        next(14_000 + Math.random() * 16_000);
      }, wait);
    };
    next(3500);
    return () => clearTimeout(timer);
  }, [fx.flyby, fx.flybyPath]);

  // Sparkles that follow the pointer.
  useEffect(() => {
    const canvas = trailRef.current;
    if (!canvas || season === "plain" || reduced() || !window.matchMedia("(pointer: fine)").matches) return;
    const ctx = canvas.getContext("2d")!;
    const parts: { x: number; y: number; vx: number; vy: number; life: number; c: string }[] = [];
    const css = getComputedStyle(document.documentElement);
    const colors = [css.getPropertyValue("--accent").trim(), css.getPropertyValue("--accent2").trim(), "#facc15"];
    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    let lastAdd = 0;
    const move = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastAdd < 28) return;
      lastAdd = now;
      for (let i = 0; i < 2; i++) parts.push({ x: e.clientX, y: e.clientY, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60 - 20, life: 1, c: colors[Math.floor(Math.random() * colors.length)] });
      if (parts.length > 80) parts.splice(0, parts.length - 80);
    };
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 40 * dt;
        p.life -= dt * 1.6;
        if (p.life <= 0) continue;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.c;
        // Little four-point stars.
        const r = 3.5 * p.life + 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - r * 2);
        ctx.quadraticCurveTo(p.x, p.y, p.x + r * 2, p.y);
        ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + r * 2);
        ctx.quadraticCurveTo(p.x, p.y, p.x - r * 2, p.y);
        ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - r * 2);
        ctx.fill();
      }
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("resize", resize);
    };
  }, [season]);

  if (season === "plain") return null;
  return (
    <>
      {/* Behind everything: the colour wash, the emoji pattern and the hills. */}
      <div aria-hidden="true" className="jl-backdrop pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="jl-wash absolute -inset-[20%]" />
        <div className="jl-pattern absolute -inset-[200px] opacity-[0.07]" style={{ backgroundImage: patternUrl(s.particles.length ? s.particles : [s.icon]) }} />
        <svg className="absolute inset-x-0 bottom-0 h-[26vh] min-h-40 w-full" viewBox="0 0 1440 260" preserveAspectRatio="none">
          <path className="jl-hill-back" d="M0 140 C 200 60 380 170 560 110 C 760 40 920 150 1100 90 C 1260 40 1360 100 1440 80 L1440 260 L0 260 Z" fill={fx.hills[0]} opacity="0.75" />
          <path className="jl-hill-mid" d="M0 190 C 160 130 320 210 520 165 C 720 120 880 205 1080 160 C 1260 120 1360 170 1440 150 L1440 260 L0 260 Z" fill={fx.hills[1]} opacity="0.7" />
          <path d="M0 225 C 240 190 420 245 700 215 C 980 185 1180 240 1440 210 L1440 260 L0 260 Z" fill={fx.hills[2]} opacity="0.65" />
        </svg>
        <div className="absolute inset-x-0 bottom-[3vh] flex justify-around px-4">
          {fx.props.map((p, i) => (
            <span
              key={i}
              className="jl-prop inline-block text-3xl sm:text-4xl"
              style={{ animationDelay: `${(i * 0.37) % 2}s`, transform: `translateY(${(i % 3) * -10}px)`, opacity: 0.85 }}
            >
              {p}
            </span>
          ))}
        </div>
      </div>
      {/* In front (never in the way of clicks): pointer sparkles and flybys. */}
      <canvas ref={trailRef} aria-hidden="true" className="jl-trail pointer-events-none fixed inset-0 z-[31] h-screen w-screen" />
      {flyby && (
        <div
          key={flyby.id}
          aria-hidden="true"
          onAnimationEnd={() => setFlyby(null)}
          className={`jl-flyby pointer-events-none fixed z-[32] ${flyby.dir === 1 ? "jl-fly-right" : "jl-fly-left"}`}
          style={{ top: fx.flybyPath === "ground" ? undefined : `${flyby.y}vh`, bottom: fx.flybyPath === "ground" ? "2vh" : undefined, fontSize: flyby.size }}
        >
          <span className={`inline-block ${fx.flybyPath === "ground" ? "jl-hop" : "jl-bob"}`} style={{ transform: flyby.dir === 1 ? "scaleX(-1)" : undefined }}>
            {fx.flyby}
          </span>
          {fx.flybyPath === "sky" && <span className="ml-1 inline-block text-[0.45em] opacity-80">✨✨</span>}
        </div>
      )}
    </>
  );
}

/** The menu bar's sound button (with the theme's click sound as the test beep). */
export function SoundToggle({ season }: { season: SeasonId }) {
  return <VolumeButton onTest={() => clickSound(SEASON_FX[season].click)} />;
}

/**
 * A sound button that opens volume sliders for sound effects and music.
 * Used in the menu bar and inside games. `className` styles the button.
 */
export function VolumeButton({ className = "", onTest }: { className?: string; onTest?: () => void }) {
  const { sfx, music } = useAudio();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  const icon = sfx === 0 && music === 0 ? "🔇" : music > 0 ? "🎵" : "🔉";
  const slider = (label: string, emoji: string, value: number, onChange: (v: number) => void) => (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between text-sm font-semibold">
        <span>
          {emoji} {label}
        </span>
        <span className="font-mono text-xs text-muted">{value === 0 ? "off" : `${Math.round(value * 100)}%`}</span>
      </span>
      <input type="range" min={0} max={100} value={Math.round(value * 100)} onChange={(e) => onChange(Number(e.target.value) / 100)} className="w-full accent-[var(--accent)]" />
    </label>
  );
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Sound and music volume"
        title="sound n music"
        className={className || `flex h-9 w-9 items-center justify-center rounded-full text-lg transition-[background-color,transform] hover:-rotate-12 hover:bg-foreground/[.06] ${music > 0 ? "jl-bob-small" : ""}`}
      >
        {icon}
      </button>
      {open && (
        <div className="jl-pop-in absolute right-0 top-11 z-50 flex w-64 flex-col gap-3 rounded-2xl border border-line bg-panel p-4 text-left text-foreground shadow-xl">
          <p className="font-display text-lg font-extrabold">🔊 sound stuff</p>
          {slider("sound effects", "💥", sfx, (v) => {
            setAudio({ sfx: v });
            if (v > 0) (onTest ?? (() => clickSound("pop")))();
          })}
          {slider("music", "🎶", music, (v) => setAudio({ music: v }))}
          <div className="flex gap-2">
            <button type="button" onClick={() => setAudio({ sfx: 0, music: 0 })} className="flex-1 rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-accent/10">
              🔇 mute all
            </button>
            <button type="button" onClick={() => setAudio({ sfx: 0.8, music: 0.6 })} className="flex-1 rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-accent/10">
              ↩️ reset
            </button>
          </div>
          <p className="text-[11px] text-muted">music starts when u click somthing (browsers r strict abt that)</p>
        </div>
      )}
    </div>
  );
}

/** Pops a falling decoration with a burst and the theme's sound (the sky layer calls this). */
export function popSound(season: SeasonId) {
  if (getAudio().sfx === 0 || season === "plain") return;
  clickSound(SEASON_FX[season].click);
  note(880 + Math.random() * 300, 0.1, "sine", 0.05, 0.02, 1.5);
}

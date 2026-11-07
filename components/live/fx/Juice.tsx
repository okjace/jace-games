"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { isMuted, setMuted } from "./sfx";

/**
 * The bits that make a game feel alive: numbers that count up, "+$40"
 * pops that float away, confetti, full-screen flashes and screen shake.
 * Wrap a screen in <Juice> and call useJuice() from anything inside it.
 */

type Pop = { id: number; text: string; color: string; x: number; y: number };
type Flash = { id: number; color: string };

type JuiceApi = {
  /** A floating label, near (x, y) in % of the screen, or the centre. */
  pop: (text: string, color?: string, x?: number, y?: number) => void;
  flash: (color: string) => void;
  shake: () => void;
  confetti: (amount?: number) => void;
};

const JuiceContext = createContext<JuiceApi>({ pop: () => {}, flash: () => {}, shake: () => {}, confetti: () => {} });
export const useJuice = () => useContext(JuiceContext);

export function Juice({ children }: { children: ReactNode }) {
  const [pops, setPops] = useState<Pop[]>([]);
  const [flashes, setFlashes] = useState<Flash[]>([]);
  const shakeRef = useRef<HTMLDivElement>(null);
  const confettiRef = useRef<{ burst: (n: number) => void } | null>(null);
  const id = useRef(0);

  const pop = useCallback((text: string, color = "#3ddc84", x?: number, y?: number) => {
    const p = { id: ++id.current, text, color, x: x ?? 40 + Math.random() * 20, y: y ?? 38 + Math.random() * 10 };
    setPops((cur) => [...cur.slice(-8), p]);
    setTimeout(() => setPops((cur) => cur.filter((q) => q.id !== p.id)), 1100);
  }, []);
  const flash = useCallback((color: string) => {
    const f = { id: ++id.current, color };
    setFlashes((cur) => [...cur, f]);
    setTimeout(() => setFlashes((cur) => cur.filter((q) => q.id !== f.id)), 450);
  }, []);
  // Restart the shake animation on the element itself (changing a React key
  // would remount the whole game and lose its state).
  const shake = useCallback(() => {
    const el = shakeRef.current;
    if (!el) return;
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "jg-shake 0.35s";
  }, []);
  const confetti = useCallback((amount = 80) => confettiRef.current?.burst(amount), []);

  return (
    <JuiceContext.Provider value={{ pop, flash, shake, confetti }}>
      <div ref={shakeRef}>{children}</div>
      <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden" aria-hidden="true">
        {flashes.map((f) => (
          <div key={f.id} className="absolute inset-0 animate-[jg-flash_0.45s_ease-out_forwards]" style={{ background: f.color }} />
        ))}
        {pops.map((p) => (
          <span
            key={p.id}
            className="absolute animate-[jg-pop-up_1.1s_ease-out_forwards] text-3xl font-black whitespace-nowrap"
            style={{ left: `${p.x}%`, top: `${p.y}%`, color: p.color, textShadow: "0 2px 0 rgba(0,0,0,0.35), 0 0 12px rgba(0,0,0,0.25)" }}
          >
            {p.text}
          </span>
        ))}
        <Confetti ref={confettiRef} />
      </div>
    </JuiceContext.Provider>
  );
}

const CONFETTI_COLORS = ["#3ddc84", "#facc15", "#38bdf8", "#f472b6", "#fb923c", "#a78bfa"];

function Confetti({ ref }: { ref: React.RefObject<{ burst: (n: number) => void } | null> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const parts = useRef<{ x: number; y: number; vx: number; vy: number; r: number; vr: number; c: string; life: number }[]>([]);
  const running = useRef(false);

  useEffect(() => {
    const run = () => {
      const c = canvas.current;
      if (!c) return;
      const ctx = c.getContext("2d")!;
      if (c.width !== window.innerWidth || c.height !== window.innerHeight) {
        c.width = window.innerWidth;
        c.height = window.innerHeight;
      }
      ctx.clearRect(0, 0, c.width, c.height);
      parts.current = parts.current.filter((p) => p.life > 0 && p.y < c.height + 20);
      for (const p of parts.current) {
        p.vy += 0.25;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        p.life--;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-5, -3, 10, 6);
        ctx.restore();
      }
      if (parts.current.length) requestAnimationFrame(run);
      else running.current = false;
    };
    ref.current = {
      burst: (n) => {
        const w = window.innerWidth;
        for (let i = 0; i < n; i++) {
          parts.current.push({
            x: w / 2 + (Math.random() - 0.5) * w * 0.3,
            y: window.innerHeight * 0.35,
            vx: (Math.random() - 0.5) * 16,
            vy: -6 - Math.random() * 10,
            r: Math.random() * 6,
            vr: (Math.random() - 0.5) * 0.3,
            c: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            life: 160,
          });
        }
        if (!running.current) {
          running.current = true;
          requestAnimationFrame(run);
        }
      },
    };
  }, [ref]);

  return <canvas ref={canvas} className="absolute inset-0 h-full w-full" />;
}

/** A number that rolls up (or down) to its new value. */
export function useCountUp(target: number, ms = 600): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - (1 - t) ** 3;
      const v = Math.round(a + (target - a) * eased);
      setShown(v);
      from.current = v;
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return shown;
}

/** A speaker button that mutes and unmutes game sounds on this device. */
export function MuteButton({ className = "" }: { className?: string }) {
  const [m, setM] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setM(isMuted());
  }, []);
  return (
    <button
      type="button"
      onClick={() => {
        setMuted(!m);
        setM(!m);
      }}
      aria-label={m ? "Turn sound on" : "Turn sound off"}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-black/20 text-lg text-white backdrop-blur ${className}`}
    >
      {m ? "🔇" : "🔊"}
    </button>
  );
}

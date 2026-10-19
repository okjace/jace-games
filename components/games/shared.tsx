"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Every game component takes these props. Call `onFinish` once when a game ends. */
export type GameProps = {
  onFinish: (score: number, durationMs: number) => void;
  /** The player's personal best, to show "New best!" in the game-over card. */
  best: number | null;
};

/** Current time in ms, for timing games (kept out of render code). */
export const now = () => performance.now();

/** The theme colors, read from CSS variables so canvases follow light/dark mode. */
export function themeColors() {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    background: v("--background"),
    panel: v("--panel"),
    line: v("--line"),
    foreground: v("--foreground"),
    muted: v("--muted"),
    accent: v("--accent"),
    onAccent: v("--on-accent"),
    danger: v("--danger"),
    warn: v("--warn"),
  };
}

/**
 * Sizes a canvas for crisp drawing on high-DPI screens and returns a 2D
 * context whose units are the logical `width`×`height`.
 */
export function setupCanvas(canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export type Dir = "up" | "down" | "left" | "right";

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  W: "up",
  S: "down",
  A: "left",
  D: "right",
};

export function keyToDir(key: string): Dir | null {
  return KEY_DIRS[key] ?? null;
}

/** Calls `onSwipe` for a swipe on `ref`'s element (min 24px). */
export function useSwipe(ref: React.RefObject<HTMLElement | null>, onSwipe: (dir: Dir) => void, enabled = true) {
  const cb = useRef(onSwipe);
  useEffect(() => {
    cb.current = onSwipe;
  }, [onSwipe]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let start: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      start = { x: e.clientX, y: e.clientY };
    };
    const up = (e: PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      start = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      cb.current(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", () => (start = null));
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
    };
  }, [ref, enabled]);
}

/** Runs `onKey` for keydown on the window while `enabled`. */
export function useKeys(onKey: (e: KeyboardEvent) => void, enabled = true) {
  const cb = useRef(onKey);
  useEffect(() => {
    cb.current = onKey;
  }, [onKey]);
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      // Leave typing in form fields alone.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // A focused button handles its own Enter/Space.
      if (t?.tagName === "BUTTON" && (e.key === "Enter" || e.key === " ")) return;
      cb.current(e);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled]);
}

export const primaryButton =
  "inline-flex h-11 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
export const secondaryButton =
  "inline-flex h-11 items-center justify-center rounded-full border border-line bg-panel px-5 text-sm font-medium transition-colors hover:bg-foreground/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** A card over the board for "Press start" and "Game over" states. */
export function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/75 p-4 backdrop-blur-sm">
      <div className="flex max-w-xs flex-col items-center gap-3 text-center">{children}</div>
    </div>
  );
}

/** The usual game-over content: score, "New best!", and a Play again button. */
export function GameOver({
  title = "Game over",
  score,
  isBest,
  onAgain,
  extra,
}: {
  title?: string;
  score: string;
  isBest: boolean;
  onAgain: () => void;
  extra?: ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // Short delay so the key that ended the game doesn't also press the button.
    const t = setTimeout(() => ref.current?.focus({ preventScroll: true }), 250);
    return () => clearTimeout(t);
  }, []);
  return (
    <Overlay>
      <p className="text-sm font-medium text-muted">{title}</p>
      <p className="text-4xl font-bold tabular-nums">{score}</p>
      {isBest && (
        <p className="animate-pop rounded-full bg-accent px-3 py-1 text-xs font-semibold text-on-accent">New best!</p>
      )}
      {extra}
      <button ref={ref} type="button" onClick={onAgain} className={primaryButton}>
        Play again
      </button>
      <p className="text-xs text-muted">or press Enter</p>
    </Overlay>
  );
}

/** Whether `score` beats `best` ("higher" or "lower" is better). */
export function beats(score: number, best: number | null, better: "higher" | "lower"): boolean {
  if (best === null) return true;
  return better === "higher" ? score > best : score < best;
}

/** An on-screen arrow pad for touch play. */
export function DPad({ onDir, className = "" }: { onDir: (d: Dir) => void; className?: string }) {
  const btn =
    "flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-panel text-xl active:bg-accent active:text-on-accent select-none";
  const press = (d: Dir) => (e: React.PointerEvent) => {
    e.preventDefault();
    onDir(d);
  };
  return (
    <div className={`touch-game grid grid-cols-3 gap-2 ${className}`} aria-hidden="true">
      <span />
      <button type="button" tabIndex={-1} className={btn} onPointerDown={press("up")}>
        ▲
      </button>
      <span />
      <button type="button" tabIndex={-1} className={btn} onPointerDown={press("left")}>
        ◀
      </button>
      <button type="button" tabIndex={-1} className={btn} onPointerDown={press("down")}>
        ▼
      </button>
      <button type="button" tabIndex={-1} className={btn} onPointerDown={press("right")}>
        ▶
      </button>
    </div>
  );
}

/** A row of small stats above a board ("Score 12 · Best 40"). */
export function Stats({ items }: { items: { label: string; value: ReactNode; accent?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((it) => (
        <div key={it.label} className="rounded-xl border border-line bg-panel px-3 py-1.5 text-sm">
          <span className="text-muted">{it.label} </span>
          <span className={`font-semibold tabular-nums ${it.accent ? "text-accent" : ""}`}>{it.value}</span>
        </div>
      ))}
    </div>
  );
}

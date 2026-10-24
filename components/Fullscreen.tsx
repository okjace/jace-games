"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useKeys } from "@/components/games/shared";

/**
 * Wraps a game so it can go fullscreen: a button (or the F key) uses the
 * Fullscreen API, and where that isn't available (iPhone Safari) it covers
 * the page instead ("focus mode"). In either case the game is scaled up to
 * fill the screen, keeping its shape. Esc exits.
 */
export function Fullscreen({
  children,
  label,
  shortcut = true,
}: {
  children: ReactNode;
  label: string;
  /** false for games that use the F key themselves (Word Guess, Minesweeper). */
  shortcut?: boolean;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"off" | "native" | "focus">("off");
  const [scale, setScale] = useState(1);
  const on = mode !== "off";

  const enter = useCallback(async () => {
    const el = outerRef.current;
    if (!el) return;
    if (el.requestFullscreen && document.fullscreenEnabled) {
      // Some browsers (and embedded views) neither enter fullscreen nor reject,
      // so give it a moment and fall back to focus mode.
      const entered = await Promise.race([
        el.requestFullscreen({ navigationUI: "hide" }).then(
          () => true,
          () => false,
        ),
        new Promise<boolean>((r) => setTimeout(() => r(false), 600)),
      ]);
      if (entered && document.fullscreenElement) {
        setMode("native");
        return;
      }
    }
    setMode("focus");
  }, []);

  const exit = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    setMode("off");
  }, []);

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setMode((m) => (m === "native" ? "off" : m));
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Focus mode: Esc exits, and the page behind doesn't scroll.
  useEffect(() => {
    if (mode !== "focus") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMode("off");
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [mode]);

  useKeys((e) => {
    if (shortcut && (e.key === "f" || e.key === "F")) {
      e.preventDefault();
      if (on) void exit();
      else void enter();
    }
  });

  // Scale the game to fit the screen while fullscreen.
  useLayoutEffect(() => {
    if (!on) return;
    const fit = () => {
      const inner = innerRef.current;
      if (!inner) return;
      const pad = 24;
      const w = inner.offsetWidth;
      const h = inner.offsetHeight;
      if (!w || !h) return;
      setScale(Math.max(0.4, Math.min((window.innerWidth - pad * 2) / w, (window.innerHeight - pad * 2 - 40) / h, 2.5)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (innerRef.current) ro.observe(innerRef.current);
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", fit);
    };
  }, [on]);

  return (
    <div
      ref={outerRef}
      className={
        on
          ? "fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-hidden bg-background"
          : "relative"
      }
      role={on ? "dialog" : undefined}
      aria-label={on ? `${label}, fullscreen` : undefined}
    >
      <div className={on ? "absolute right-3 top-3 z-10 flex gap-2" : "mb-2 flex justify-end"}>
        <button
          type="button"
          onClick={() => void (on ? exit() : enter())}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-panel px-3 text-sm font-medium text-muted transition-colors hover:bg-foreground/[.05] hover:text-foreground"
          title={on ? "Exit fullscreen (Esc)" : shortcut ? "Fullscreen (F)" : "Fullscreen"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {on ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
          </svg>
          {on ? "Exit" : "Fullscreen"}
        </button>
      </div>
      <div
        ref={innerRef}
        style={
          on
            ? { width: "min(calc(100vw - 48px), 640px)", transform: `scale(${on ? scale : 1})`, transformOrigin: "center center" }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}

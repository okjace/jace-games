"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

/**
 * Fullscreen for a whole Live screen (player stage or host screen). Uses the
 * Fullscreen API where it works, and otherwise covers the page ("focus
 * mode", e.g. iPhone Safari). While on, give the element FULLSCREEN_CLASS so
 * it fills the screen and scrolls. Esc exits.
 */
export const FULLSCREEN_CLASS = "!fixed !inset-0 !z-[70] !m-0 overflow-y-auto";

export function useStageFullscreen(ref: RefObject<HTMLElement | null>) {
  const [mode, setMode] = useState<"off" | "native" | "focus">("off");

  const enter = useCallback(async () => {
    const el = ref.current;
    if (!el) return;
    if (el.requestFullscreen && document.fullscreenEnabled) {
      const ok = await Promise.race([
        el.requestFullscreen({ navigationUI: "hide" }).then(
          () => true,
          () => false,
        ),
        new Promise<boolean>((r) => setTimeout(() => r(false), 600)),
      ]);
      if (ok && document.fullscreenElement) return setMode("native");
    }
    setMode("focus");
  }, [ref]);

  const exit = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    setMode("off");
  }, []);

  useEffect(() => {
    const onChange = () => !document.fullscreenElement && setMode((m) => (m === "native" ? "off" : m));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

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

  const on = mode !== "off";
  return { on, toggle: () => void (on ? exit() : enter()) };
}

/** The ⛶ button. */
export function FullscreenButton({ on, toggle, className = "" }: { on: boolean; toggle: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={on ? "Exit fullscreen" : "Fullscreen"}
      title={on ? "Exit fullscreen (Esc)" : "Fullscreen"}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${className}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        {on ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
      </svg>
    </button>
  );
}

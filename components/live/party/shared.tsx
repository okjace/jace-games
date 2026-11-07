"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlayerView } from "@/lib/live/engine";
import type { PlayerQuestion } from "@/lib/live/types";

export type Act = (b: Record<string, unknown>) => Promise<PlayerView | null>;

export type PartyProps = {
  view: PlayerView;
  busy: boolean;
  act: Act;
  /** The Earn panel (question or tap button), placed by each mode. */
  earn: React.ReactNode;
};

/**
 * Keeps a device-mode game's own state (towers, upgrades, coins spent) in
 * this browser, so a reload carries on where you were. The server only
 * knows what you earned and your best score.
 */
export function useSaved<T>(code: string, mode: string, initial: () => T): [T, (fn: (s: T) => T) => void] {
  const key = `jace-games:live:${code}:${mode}`;
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return { ...initial(), ...JSON.parse(raw) };
    } catch {}
    return initial();
  });
  const update = useCallback(
    (fn: (s: T) => T) =>
      setState((cur) => {
        const next = fn(cur);
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {}
        return next;
      }),
    [key],
  );
  return [state, update];
}

/** Sends the mini-game's score to the server every couple of seconds when it changes. */
export function useReport(act: Act, score: number) {
  const sent = useRef(-1);
  const latest = useRef(score);
  useEffect(() => {
    latest.current = score;
  }, [score]);
  useEffect(() => {
    const t = setInterval(() => {
      if (latest.current !== sent.current) {
        sent.current = latest.current;
        void act({ action: "report", score: Math.floor(latest.current) });
      }
    }, 2000);
    return () => clearInterval(t);
  }, [act]);
}

/**
 * Earning for party modes: keeps a question ready (with questions on),
 * answers it, or taps (with questions off). A short toast says what you got.
 */
export function useEarn(view: PlayerView, act: Act) {
  const [toast, setToast] = useState<{ text: string; good: boolean; id: number } | null>(null);
  const fetching = useRef(false);
  const needsQuestion = !view.noSet && !view.selfQuestion && view.status === "playing" && !(view.mode === "hack" && !view.party.password);

  useEffect(() => {
    if (!needsQuestion || fetching.current) return;
    fetching.current = true;
    void act({ action: "next" }).finally(() => (fetching.current = false));
  }, [needsQuestion, act]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const say = (text: string, good: boolean) => setToast({ text, good, id: Date.now() });

  const answer = async (a: number | string) => {
    const v = await act({ action: "answer", answer: a });
    const last = v?.last;
    if (last?.correct === false) say(`Not quite${Array.isArray(last.right) ? ` (it was ${(last.right as string[]).join(" / ")})` : ""}`, false);
    return v;
  };
  const tap = () => act({ action: "tap" });
  return { question: view.selfQuestion as PlayerQuestion | null, answer, tap, toast, say };
}

export function Toast({ toast }: { toast: { text: string; good: boolean; id: number } | null }) {
  if (!toast) return null;
  return (
    <div key={toast.id} role="status" className={`animate-pop pointer-events-none fixed inset-x-0 bottom-6 z-50 mx-auto w-fit max-w-[90vw] rounded-full px-5 py-2.5 text-center font-semibold shadow-lg ${toast.good ? "bg-accent text-on-accent" : "bg-danger text-white"}`}>
      {toast.text}
    </div>
  );
}

/** The big button players press when the host turned questions off. */
export function TapButton({ label, sub, onTap, disabled }: { label: string; sub: string; onTap: () => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <button
        type="button"
        disabled={disabled}
        onClick={onTap}
        className="flex h-36 w-36 items-center justify-center rounded-full bg-accent text-2xl font-black text-on-accent shadow-[0_8px_0_rgba(0,0,0,0.25)] transition-transform active:translate-y-1 active:scale-95 disabled:opacity-60"
      >
        {label}
      </button>
      <p className="text-sm text-muted">{sub}</p>
    </div>
  );
}

/** Two tabs for device modes on small screens: play the game, or answer to earn. */
export function Tabs({ tab, setTab, earnBadge }: { tab: "play" | "earn"; setTab: (t: "play" | "earn") => void; earnBadge?: string }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-full border border-line bg-panel p-1 text-sm font-semibold" role="tablist">
      {(["play", "earn"] as const).map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={tab === t}
          onClick={() => setTab(t)}
          className={`rounded-full py-2 ${tab === t ? "bg-accent text-on-accent" : "text-muted"}`}
        >
          {t === "play" ? "🎮 Play" : `❓ Earn${earnBadge ? ` ${earnBadge}` : ""}`}
        </button>
      ))}
    </div>
  );
}

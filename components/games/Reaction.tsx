"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { beats, primaryButton, useKeys, type GameProps } from "./shared";

const ROUNDS = 5;

type Phase = "intro" | "wait" | "go" | "early" | "result" | "done";

export default function Reaction({ onFinish, best }: GameProps) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [times, setTimes] = useState<number[]>([]);
  const [wasBest, setWasBest] = useState(false);
  const goAt = useRef(0);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const arm = useCallback(() => {
    setPhase("wait");
    timer.current = setTimeout(() => {
      goAt.current = performance.now();
      setPhase("go");
    }, 1200 + Math.random() * 2800);
  }, []);

  const average = (list: number[]) => Math.round(list.reduce((a, b) => a + b, 0) / list.length);

  const hit = () => {
    if (phase === "intro") {
      setTimes([]);
      startedAt.current = performance.now();
      arm();
    } else if (phase === "wait") {
      if (timer.current) clearTimeout(timer.current);
      setPhase("early");
    } else if (phase === "go") {
      const t = Math.round(performance.now() - goAt.current);
      const next = [...times, t];
      setTimes(next);
      if (next.length >= ROUNDS) {
        const avg = average(next);
        setPhase("done");
        setWasBest(beats(avg, best, "lower"));
        // Taps under 100 ms are guesses, not reactions; those runs aren't saved.
        if (next.every((x) => x >= 100)) onFinish(avg, performance.now() - startedAt.current);
      } else setPhase("result");
    } else if (phase === "early" || phase === "result") {
      arm();
    } else if (phase === "done") {
      setPhase("intro");
      setTimes([]);
    }
  };

  useKeys((e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (!e.repeat) hit();
    }
  });

  const last = times[times.length - 1];
  const tooFast = phase === "done" && times.some((x) => x < 100);
  const styles: Record<Phase, string> = {
    intro: "bg-panel",
    wait: "bg-danger/80 text-white",
    go: "bg-accent text-on-accent",
    early: "bg-warn/80 text-background",
    result: "bg-panel",
    done: "bg-panel",
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        role="button"
        tabIndex={0}
        aria-live="polite"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("a,button")) return;
          e.preventDefault();
          hit();
        }}
        className={`touch-game flex aspect-[4/3] w-full max-w-[560px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-line p-6 text-center transition-colors duration-75 outline-none focus-visible:ring-2 focus-visible:ring-accent ${styles[phase]}`}
      >
        {phase === "intro" && (
          <>
            <span className="text-5xl">⚡</span>
            <p className="text-2xl font-bold">Reaction time</p>
            <p className="max-w-xs text-sm text-muted">
              When the box turns green, tap it (or press Space) as fast as you can. Five tries; your average counts.
            </p>
            <span className={primaryButton}>Tap to start</span>
          </>
        )}
        {phase === "wait" && <p className="text-3xl font-bold">Wait for green…</p>}
        {phase === "go" && <p className="text-5xl font-black">TAP!</p>}
        {phase === "early" && (
          <>
            <p className="text-3xl font-bold">Too soon!</p>
            <p className="text-sm">Tap to try that one again.</p>
          </>
        )}
        {phase === "result" && (
          <>
            <p className="text-5xl font-bold tabular-nums">{last} ms</p>
            <p className="text-sm text-muted">
              Try {times.length} of {ROUNDS}. Tap to keep going.
            </p>
          </>
        )}
        {phase === "done" && (
          <>
            <p className="text-sm text-muted">Your average</p>
            <p className="text-5xl font-bold tabular-nums">{average(times)} ms</p>
            {wasBest && !tooFast && (
              <p className="animate-pop rounded-full bg-accent px-3 py-1 text-xs font-semibold text-on-accent">New best!</p>
            )}
            {tooFast && <p className="text-sm text-warn">A tap under 100 ms looks like a guess, so this run wasn&apos;t saved.</p>}
            <p className="text-sm text-muted">Tap or press Enter to play again.</p>
          </>
        )}
      </div>
      <div className="flex gap-2" aria-label="Tries">
        {Array.from({ length: ROUNDS }, (_, i) => (
          <div
            key={i}
            className={`min-w-16 rounded-xl border px-2 py-1.5 text-center text-sm tabular-nums ${
              times[i] ? "border-line bg-panel" : "border-dashed border-line text-muted"
            }`}
          >
            {times[i] ? `${times[i]}` : `#${i + 1}`}
          </div>
        ))}
      </div>
    </div>
  );
}

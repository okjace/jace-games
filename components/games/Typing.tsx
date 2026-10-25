"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TYPING_WORDS } from "@/lib/words";
import { GameOver, Stats, beats, useGameRandom, type GameProps } from "./shared";

const SECONDS = 30;

function makeWords(rand: () => number = Math.random, count = 120): string[] {
  return Array.from({ length: count }, () => TYPING_WORDS[Math.floor(rand() * TYPING_WORDS.length)]);
}

/** 30-second typing test. WPM counts correctly typed words (5 characters = 1 word). */
export default function Typing({ onFinish, best, seed, onProgress }: GameProps) {
  const rand = useGameRandom(seed);
  const [words, setWords] = useState<string[]>(() => makeWords(rand));
  const [typed, setTyped] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [left, setLeft] = useState(SECONDS);
  const [done, setDone] = useState<{ wpm: number; accuracy: number } | null>(null);
  const [wasBest, setWasBest] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const state = useRef({ typed, input, words });
  useEffect(() => {
    state.current = { typed, input, words };
  }, [typed, input, words]);

  const score = useCallback((list: string[], all: string[]) => {
    let chars = 0;
    let correctWords = 0;
    list.forEach((w, i) => {
      if (w === all[i]) {
        chars += w.length + 1;
        correctWords++;
      }
    });
    return { wpm: Math.round(chars / 5 / (SECONDS / 60)), accuracy: list.length ? Math.round((correctWords / list.length) * 100) : 0 };
  }, []);

  // Countdown.
  useEffect(() => {
    if (startedAt === null || done) return;
    const t = setInterval(() => {
      const elapsed = (performance.now() - startedAt) / 1000;
      setLeft(Math.max(0, Math.ceil(SECONDS - elapsed)));
      if (onProgress && elapsed > 3) {
        // Live words-per-minute so far, for opponents in a race.
        const { typed: tw, words: all } = state.current;
        onProgress(Math.round((score(tw, all).wpm * SECONDS) / Math.min(elapsed, SECONDS)));
      }
      if (elapsed >= SECONDS) {
        clearInterval(t);
        const { typed: tw, input: cur, words: all } = state.current;
        // A word in progress counts if it's already right.
        const list = cur && all[tw.length] === cur ? [...tw, cur] : tw;
        const result = score(list, all);
        setDone(result);
        setWasBest(result.wpm > 0 && beats(result.wpm, best, "higher"));
        onFinish(result.wpm, performance.now() - startedAt);
      }
    }, 100);
    return () => clearInterval(t);
  }, [startedAt, done, score, onFinish, best, onProgress]);

  // Keep the current word in view.
  useEffect(() => {
    const el = wordRefs.current[typed.length];
    const box = boxRef.current;
    if (el && box) box.scrollTop = Math.max(0, el.offsetTop - box.offsetTop - 44);
  }, [typed.length]);

  const reset = useCallback(() => {
    rand.reset();
    setWords(makeWords(rand));
    setTyped([]);
    setInput("");
    setStartedAt(null);
    setLeft(SECONDS);
    setDone(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [rand]);

  useEffect(() => {
    if (!done) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.target as HTMLElement)?.tagName !== "BUTTON") reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, reset]);

  const onChange = (value: string) => {
    if (done) return;
    if (startedAt === null && value.trim()) setStartedAt(performance.now());
    if (/\s/.test(value)) {
      // Autocomplete or a paste can add several words at once.
      const parts = value.split(/\s+/);
      const rest = parts.pop() ?? "";
      const finished = parts.filter(Boolean);
      if (finished.length) setTyped((t) => [...t, ...finished]);
      setInput(rest);
    } else setInput(value);
  };

  const live = startedAt ? score(typed, words) : { wpm: 0, accuracy: 0 };
  const elapsedFrac = startedAt ? (SECONDS - left) / SECONDS : 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <Stats
        items={[
          { label: "Time", value: `${left}s` },
          { label: "WPM", value: elapsedFrac > 0.1 ? Math.round(live.wpm / Math.max(elapsedFrac, 0.1)) : "—" },
          { label: "Best", value: best ?? "—", accent: true },
        ]}
      />
      <div className="relative w-full max-w-2xl">
        <div
          ref={boxRef}
          onClick={() => inputRef.current?.focus()}
          className="relative h-36 overflow-hidden rounded-2xl border border-line bg-panel p-4 font-mono text-xl leading-[2.75rem] sm:text-2xl"
        >
          {words.map((w, i) => {
            const isCurrent = i === typed.length;
            const done = i < typed.length;
            const right = done && typed[i] === w;
            const partialWrong = isCurrent && !w.startsWith(input);
            return (
              <span
                key={i}
                ref={(el) => {
                  wordRefs.current[i] = el;
                }}
                className={`mr-3 inline-block rounded-md px-0.5 ${
                  done ? (right ? "text-accent" : "text-danger line-through") : isCurrent ? (partialWrong ? "bg-danger/20" : "bg-foreground/[.08]") : "text-muted"
                }`}
              >
                {w}
              </span>
            );
          })}
        </div>
        {done && (
          <GameOver
            title="Time!"
            score={`${done.wpm} WPM`}
            isBest={wasBest}
            onAgain={reset}
            extra={<p className="text-sm text-muted">{done.accuracy}% of words correct</p>}
          />
        )}
      </div>
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => onChange(e.target.value)}
        disabled={!!done}
        autoFocus
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="next"
        aria-label="Type the highlighted word, then press space"
        placeholder={startedAt ? "" : "Start typing to begin…"}
        className="h-12 w-full max-w-2xl rounded-full border border-line bg-panel px-5 font-mono text-lg outline-none focus:border-accent"
      />
      <p className="text-xs text-muted">Type each word and press space. The 30-second timer starts with your first letter.</p>
    </div>
  );
}

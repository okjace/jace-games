"use client";

import { useCallback, useRef, useState } from "react";
import { WORDLE_ANSWERS } from "@/lib/words";
import { GameOver, Overlay, beats, primaryButton, useKeys, type GameProps } from "./shared";

const LEN = 5;
const TRIES = 6;
type Mark = "hit" | "near" | "miss";

const pick = () => WORDLE_ANSWERS[Math.floor(Math.random() * WORDLE_ANSWERS.length)];

/** Marks a guess like Wordle does, handling repeated letters correctly. */
function mark(guess: string, answer: string): Mark[] {
  const out: Mark[] = Array(LEN).fill("miss");
  const left: Record<string, number> = {};
  for (let i = 0; i < LEN; i++) {
    if (guess[i] === answer[i]) out[i] = "hit";
    else left[answer[i]] = (left[answer[i]] ?? 0) + 1;
  }
  for (let i = 0; i < LEN; i++) {
    if (out[i] !== "hit" && left[guess[i]]) {
      out[i] = "near";
      left[guess[i]]--;
    }
  }
  return out;
}

const MARK_CLASS: Record<Mark, string> = {
  hit: "bg-accent text-on-accent border-accent",
  near: "bg-warn text-background border-warn",
  miss: "bg-foreground/[.14] text-foreground border-transparent",
};

const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

export default function Wordle({ onFinish, best }: GameProps) {
  const [answer, setAnswer] = useState(pick);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [state, setState] = useState<"playing" | "won" | "lost">("playing");
  const [shake, setShake] = useState(false);
  const [wasBest, setWasBest] = useState(false);
  const startedAt = useRef<number | null>(null);

  const reset = useCallback(() => {
    setAnswer(pick());
    setGuesses([]);
    setCurrent("");
    setState("playing");
    startedAt.current = null;
  }, []);

  const submit = () => {
    if (current.length !== LEN) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    const next = [...guesses, current];
    setGuesses(next);
    setCurrent("");
    if (current === answer) {
      setState("won");
      setWasBest(beats(next.length, best, "lower"));
      onFinish(next.length, performance.now() - (startedAt.current ?? performance.now()));
    } else if (next.length >= TRIES) {
      setState("lost");
    }
  };

  const press = (key: string) => {
    if (state !== "playing") {
      if (key === "enter") reset();
      return;
    }
    if (key === "enter") return submit();
    if (key === "back") return setCurrent((c) => c.slice(0, -1));
    if (/^[a-z]$/.test(key) && current.length < LEN) {
      if (startedAt.current === null) startedAt.current = performance.now();
      setCurrent((c) => c + key);
    }
  };

  useKeys((e) => {
    if (e.key === "Enter") press("enter");
    else if (e.key === "Backspace") press("back");
    else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
    else return;
    e.preventDefault();
  });

  // Best mark per letter, for the on-screen keyboard.
  const keyMarks: Record<string, Mark> = {};
  for (const g of guesses) {
    mark(g, answer).forEach((m, i) => {
      const prev = keyMarks[g[i]];
      if (m === "hit" || (m === "near" && prev !== "hit") || (m === "miss" && !prev)) keyMarks[g[i]] = m;
    });
  }

  const rows = Array.from({ length: TRIES }, (_, r) => {
    if (r < guesses.length) return { letters: guesses[r], marks: mark(guesses[r], answer) };
    if (r === guesses.length) return { letters: current, marks: null };
    return { letters: "", marks: null };
  });

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative">
        <div className="grid gap-1.5" aria-label="Guesses" role="grid">
          {rows.map((row, r) => (
            <div
              key={r}
              role="row"
              className={`grid grid-cols-5 gap-1.5 ${shake && r === guesses.length ? "animate-[pop_0.3s]" : ""}`}
            >
              {Array.from({ length: LEN }, (_, i) => {
                const letter = row.letters[i] ?? "";
                const m = row.marks?.[i];
                return (
                  <div
                    key={i}
                    role="gridcell"
                    aria-label={letter ? `${letter}${m ? `, ${m === "hit" ? "correct" : m === "near" ? "wrong spot" : "not in word"}` : ""}` : "empty"}
                    className={`flex h-13 w-13 items-center justify-center rounded-xl border-2 text-2xl font-bold uppercase sm:h-14 sm:w-14 ${
                      m ? `${MARK_CLASS[m]} animate-flip-in` : letter ? "border-muted bg-panel" : "border-line bg-panel"
                    }`}
                    style={m ? { animationDelay: `${i * 60}ms` } : undefined}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {state === "won" && <GameOver title="You got it!" score={`${guesses.length}/6`} isBest={wasBest} onAgain={reset} extra={<p className="text-sm uppercase tracking-widest text-muted">{answer}</p>} />}
        {state === "lost" && (
          <Overlay>
            <p className="text-sm text-muted">The word was</p>
            <p className="text-3xl font-bold uppercase tracking-widest">{answer}</p>
            <p className="text-xs text-muted">Only solved words count toward your score.</p>
            <button type="button" onClick={reset} className={primaryButton} autoFocus>
              Play again
            </button>
          </Overlay>
        )}
      </div>

      <div className="touch-game flex w-full max-w-[500px] flex-col gap-1.5" aria-label="Keyboard">
        {KEY_ROWS.map((row, r) => (
          <div key={row} className="flex justify-center gap-1.5">
            {r === 2 && (
              <KeyButton label="Enter" wide onPress={() => press("enter")} />
            )}
            {row.split("").map((k) => (
              <KeyButton key={k} label={k} mark={keyMarks[k]} onPress={() => press(k)} />
            ))}
            {r === 2 && <KeyButton label="⌫" aria="Backspace" wide onPress={() => press("back")} />}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">Type with your keyboard or tap the keys. Any five letters count as a guess.</p>
    </div>
  );
}

function KeyButton({
  label,
  mark: m,
  wide,
  aria,
  onPress,
}: {
  label: string;
  mark?: Mark;
  wide?: boolean;
  aria?: string;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={aria ?? label}
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      className={`flex h-12 items-center justify-center rounded-lg text-sm font-semibold uppercase select-none ${
        wide ? "flex-[1.5] px-1 text-xs" : "flex-1"
      } ${m ? MARK_CLASS[m] : "bg-foreground/[.08] active:bg-foreground/[.16]"} max-w-12 ${wide ? "max-w-18" : ""}`}
    >
      {label}
    </button>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameOver, now, Stats, beats, type GameProps } from "./shared";

const SYMBOLS = ["🐱", "🐶", "🦊", "🐼", "🐸", "🐵", "🦁", "🐯"];
const COLS = 4;

type Card = { id: number; symbol: string; matched: boolean };

function shuffledDeck(): Card[] {
  const deck = [...SYMBOLS, ...SYMBOLS].map((symbol, i) => ({ id: i, symbol, matched: false }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** Memory Match, same rules as the original Jace game: a move is each pair of cards turned over. */
export default function Memory({ onFinish, best }: GameProps) {
  const [cards, setCards] = useState<Card[]>(() => shuffledDeck());
  const [open, setOpen] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const [wasBest, setWasBest] = useState(false);
  const startedAt = useRef<number | null>(null);
  const busy = useRef(false);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const reset = useCallback(() => {
    setCards(shuffledDeck());
    setOpen([]);
    setMoves(0);
    setWon(false);
    startedAt.current = null;
    busy.current = false;
    setTimeout(() => btnRefs.current[0]?.focus(), 0);
  }, []);

  const flip = (index: number) => {
    if (busy.current || won) return;
    const card = cards[index];
    if (card.matched || open.includes(index)) return;
    if (startedAt.current === null) startedAt.current = now();
    const next = [...open, index];
    setOpen(next);
    if (next.length < 2) return;

    const m = moves + 1;
    setMoves(m);
    const [a, b] = next;
    if (cards[a].symbol === cards[b].symbol) {
      const updated = cards.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c));
      setCards(updated);
      setOpen([]);
      if (updated.every((c) => c.matched)) {
        setWasBest(beats(m, best, "lower"));
        setWon(true);
        onFinish(m, now() - (startedAt.current ?? now()));
      }
    } else {
      busy.current = true;
      setTimeout(() => {
        setOpen([]);
        busy.current = false;
      }, 700);
    }
  };

  useEffect(() => {
    if (!won) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.target as HTMLElement)?.tagName !== "BUTTON") reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [won, reset]);

  // Arrow keys move between cards.
  const onCardKey = (e: React.KeyboardEvent, i: number) => {
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLS, ArrowDown: COLS }[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    const j = (i + delta + cards.length) % cards.length;
    btnRefs.current[j]?.focus();
  };

  const matchedCount = cards.filter((c) => c.matched).length / 2;

  return (
    <div className="flex flex-col items-center gap-4">
      <Stats
        items={[
          { label: "Moves", value: moves },
          { label: "Pairs", value: `${matchedCount}/8` },
          { label: "Best", value: best ?? "—", accent: true },
        ]}
      />
      <div className="relative w-full max-w-[440px]">
        <div className="grid grid-cols-4 gap-2 sm:gap-3" role="grid" aria-label="Memory cards">
          {cards.map((card, i) => {
            const shown = card.matched || open.includes(i);
            return (
              <button
                key={card.id}
                ref={(el) => {
                  btnRefs.current[i] = el;
                }}
                type="button"
                onClick={() => flip(i)}
                onKeyDown={(e) => onCardKey(e, i)}
                aria-label={shown ? card.symbol : `Card ${i + 1}, face down`}
                className={`flex aspect-square items-center justify-center rounded-2xl border text-3xl transition-all duration-200 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:text-4xl ${
                  card.matched
                    ? "border-accent/50 bg-accent/15"
                    : shown
                      ? "border-line bg-panel"
                      : "border-line bg-foreground/[.06] hover:bg-foreground/[.1]"
                }`}
              >
                <span className={shown ? "animate-flip-in" : "opacity-0"}>{shown ? card.symbol : "?"}</span>
              </button>
            );
          })}
        </div>
        {won && <GameOver title="Board cleared!" score={`${moves} moves`} isBest={wasBest} onAgain={reset} />}
      </div>
      <p className="text-xs text-muted">Tap or click cards. Keyboard: Tab or arrow keys to move, Enter to flip.</p>
    </div>
  );
}

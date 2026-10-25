"use client";

import { useRef } from "react";
import type { MemoryView } from "@/lib/multiplayer/rules/memory";
import { SEAT_COLORS, type TurnGameProps } from "./types";

const COLS = 4;

export default function MemoryMatch({ view, seat, turn, players, onMove, busy, local }: TurnGameProps<MemoryView, { card: number }>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const myTurn = seat !== null && turn.includes(seat) && !busy;
  const over = view.owner.every((o) => o !== -1);
  const name = (s: number) => players.find((p) => p.seat === s)?.name ?? `Player ${s + 1}`;
  const top = Math.max(...view.scores);
  const winners = view.scores.flatMap((v, i) => (v === top ? [i] : []));

  const status = over
    ? winners.length > 1
      ? "It's a tie!"
      : local
        ? `${name(winners[0])} wins!`
        : winners[0] === seat
          ? "You win!"
          : `${name(winners[0])} wins.`
    : local
      ? `${name(view.turn)}'s turn`
      : myTurn
        ? "Your turn: flip two cards"
        : `${name(view.turn)} is flipping…`;

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLS, ArrowDown: COLS }[e.key];
    if (d === undefined) return;
    e.preventDefault();
    refs.current[(i + d + 16) % 16]?.focus();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="flex items-center gap-2 text-lg font-semibold" aria-live="polite">
        {!over && <span className="h-4 w-4 rounded-full" style={{ background: SEAT_COLORS[view.turn] }} />}
        {status}
      </p>
      <div className="flex flex-wrap justify-center gap-2 text-sm">
        {players.map((p) => (
          <span
            key={p.seat}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 ${view.turn === p.seat && !over ? "border-accent" : "border-line"} bg-panel`}
          >
            <span className="h-3 w-3 rounded-full" style={{ background: SEAT_COLORS[p.seat] }} />
            {p.name}
            {p.you && !local && <span className="text-muted">(you)</span>}
            <span className="font-semibold tabular-nums">{view.scores[p.seat] ?? 0}</span>
          </span>
        ))}
      </div>
      <div className="grid w-full max-w-[420px] grid-cols-4 gap-2 sm:gap-3">
        {view.cards.map((c, i) => {
          const owner = view.owner[i];
          const shown = c !== null;
          return (
            <button
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              disabled={!myTurn || shown && !view.miss || over}
              onClick={() => onMove({ card: i })}
              onKeyDown={(e) => onKey(e, i)}
              aria-label={shown ? c! : `Card ${i + 1}, face down`}
              className="flex aspect-square items-center justify-center rounded-2xl border text-3xl transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default sm:text-4xl"
              style={{
                borderColor: owner !== -1 ? SEAT_COLORS[owner] : "var(--line)",
                background: owner !== -1 ? `${SEAT_COLORS[owner]}26` : shown ? "var(--panel)" : "color-mix(in srgb, var(--foreground) 6%, transparent)",
              }}
            >
              <span className={shown ? "animate-flip-in" : "opacity-0"}>{shown ? c : "?"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

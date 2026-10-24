"use client";

import { useState } from "react";
import { COLS, ROWS, type C4State } from "@/lib/multiplayer/rules/connect4";
import { useKeys } from "@/components/games/shared";
import { SEAT_COLORS, type TurnGameProps } from "./types";

export default function ConnectFour({ view, seat, turn, players, onMove, busy, local }: TurnGameProps<C4State, { col: number }>) {
  const [hover, setHover] = useState(3);
  const myTurn = seat !== null && turn.includes(seat) && !busy;
  const over = view.winner !== null || view.draw;
  const name = (s: number) => players.find((p) => p.seat === s)?.name ?? `Player ${s + 1}`;

  const drop = (col: number) => {
    if (!myTurn || over || view.board[0][col] !== -1) return;
    onMove({ col });
  };

  useKeys((e) => {
    if (!myTurn || over) return;
    if (e.key === "ArrowLeft") setHover((h) => (h + COLS - 1) % COLS);
    else if (e.key === "ArrowRight") setHover((h) => (h + 1) % COLS);
    else if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") drop(hover);
    else if (/^[1-7]$/.test(e.key)) drop(Number(e.key) - 1);
    else return;
    e.preventDefault();
  });

  const inLine = (r: number, c: number) => !!view.line?.some(([lr, lc]) => lr === r && lc === c);
  const status = over
    ? view.draw
      ? "It's a draw!"
      : local
        ? `${name(view.winner!)} wins!`
        : view.winner === seat
          ? "You win!"
          : `${name(view.winner!)} wins.`
    : local
      ? `${name(view.turn)}'s turn`
      : myTurn
        ? "Your turn"
        : `Waiting for ${name(view.turn)}…`;

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="flex items-center gap-2 text-lg font-semibold" aria-live="polite">
        {!over && <span className="h-4 w-4 rounded-full" style={{ background: SEAT_COLORS[view.turn] }} />}
        {status}
      </p>
      <div
        className="touch-game grid w-full max-w-[460px] gap-1.5 rounded-2xl border border-line bg-[#1d4ed8]/80 p-2 sm:gap-2 sm:p-3"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
        role="grid"
        aria-label="Connect Four board. Arrow keys to choose a column, Enter to drop, or press 1 to 7."
        onPointerLeave={() => setHover(-1)}
      >
        {Array.from({ length: COLS }, (_, c) => (
          <button
            key={c}
            type="button"
            aria-label={`Drop in column ${c + 1}`}
            disabled={!myTurn || over || view.board[0][c] !== -1}
            onClick={() => drop(c)}
            onPointerEnter={() => setHover(c)}
            onFocus={() => setHover(c)}
            className={`col-span-1 row-span-6 flex flex-col gap-1.5 rounded-xl outline-none sm:gap-2 ${
              myTurn && hover === c && !over ? "bg-white/10" : ""
            } focus-visible:ring-2 focus-visible:ring-white`}
            style={{ gridColumn: c + 1, gridRow: "1 / span 6" }}
          >
            {Array.from({ length: ROWS }, (_, r) => {
              const v = view.board[r][c];
              const isLast = view.last?.[0] === r && view.last?.[1] === c;
              return (
                <span
                  key={r}
                  className={`block aspect-square w-full rounded-full ${isLast ? "animate-pop" : ""} ${inLine(r, c) ? "ring-4 ring-white" : ""}`}
                  style={{ background: v === -1 ? "var(--background)" : SEAT_COLORS[v] }}
                />
              );
            })}
          </button>
        ))}
      </div>
      <div className="flex gap-3 text-sm">
        {players.slice(0, 2).map((p) => (
          <span key={p.seat} className="flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1">
            <span className="h-3 w-3 rounded-full" style={{ background: SEAT_COLORS[p.seat] }} />
            {p.name}
            {p.you && !local && <span className="text-muted">(you)</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

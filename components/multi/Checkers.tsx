"use client";

import { useState } from "react";
import { legalMoves, type CheckersMove, type CheckersState } from "@/lib/multiplayer/rules/checkers";
import { useGridCursor } from "./GridCursor";
import { SEAT_COLORS, type TurnGameProps } from "./types";

export default function Checkers({ view, seat, turn, players, onMove, busy, local }: TurnGameProps<CheckersState, CheckersMove>) {
  const [selected, setSelected] = useState<number | null>(null);
  const myTurn = seat !== null && turn.includes(seat) && !busy;
  const over = view.winner !== null || view.draw;
  // Seat 1 sees the board from their side.
  const flip = !local && seat === 1;
  const legal = myTurn && !over ? legalMoves(view, seat!) : [];
  const from = view.chain ?? selected;
  const targets = legal.filter((m) => m.from === from).map((m) => m.to);
  const movable = new Set(legal.map((m) => m.from));
  const name = (s: number) => players.find((p) => p.seat === s)?.name ?? `Player ${s + 1}`;

  const pick = (cell: number) => {
    if (!myTurn || over) return;
    if (from !== null && targets.includes(cell)) {
      onMove({ from, to: cell });
      setSelected(null);
    } else if (movable.has(cell) && view.chain === null) setSelected(cell === selected ? null : cell);
  };
  const { cursor } = useGridCursor(8, (c) => pick(flip ? 63 - c : c), myTurn && !over, 40);

  const mustJump = legal.some((m) => Math.abs(Math.floor(m.from / 8) - Math.floor(m.to / 8)) === 2);
  const status = over
    ? view.draw
      ? "It's a draw!"
      : local
        ? `${name(view.winner!)} wins!`
        : view.winner === seat
          ? "You win!"
          : `${name(view.winner!)} wins.`
    : `${local ? `${name(view.turn)}'s turn` : myTurn ? "Your turn" : `Waiting for ${name(view.turn)}…`}${myTurn && mustJump ? " — you must capture" : ""}`;

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="flex items-center gap-2 text-lg font-semibold" aria-live="polite">
        {!over && <span className="h-4 w-4 rounded-full" style={{ background: SEAT_COLORS[view.turn] }} />}
        {status}
      </p>
      <div className="touch-game grid w-full max-w-[480px] grid-cols-8 overflow-hidden rounded-2xl border border-line" role="grid" aria-label="Checkers board. Arrow keys move, Enter picks a piece, then a square.">
        {Array.from({ length: 64 }, (_, shown) => {
          const i = flip ? 63 - shown : shown;
          const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
          const p = view.board[i];
          const isTarget = targets.includes(i);
          const isLast = view.last?.includes(i);
          return (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              onClick={() => pick(i)}
              aria-label={`${p ? `${name(p.seat)} ${p.king ? "king" : "piece"}` : "empty"}`}
              className={`relative flex aspect-square items-center justify-center ${dark ? "bg-[#3a3f4a]" : "bg-[#d9dde3]"} ${cursor === shown ? "ring-4 ring-inset ring-accent" : ""}`}
            >
              {isLast && dark && <span className="absolute inset-0 bg-warn/20" />}
              {p && (
                <span
                  className={`relative flex h-[78%] w-[78%] items-center justify-center rounded-full text-lg shadow-[inset_0_-4px_0_rgba(0,0,0,0.25)] ${from === i ? "ring-4 ring-white" : movable.has(i) && myTurn ? "ring-2 ring-white/50" : ""}`}
                  style={{ background: SEAT_COLORS[p.seat] }}
                >
                  {p.king ? "♛" : ""}
                </span>
              )}
              {isTarget && <span className="absolute h-1/3 w-1/3 rounded-full bg-accent/80" />}
            </button>
          );
        })}
      </div>
      <div className="flex gap-3 text-sm">
        {players.slice(0, 2).map((p) => (
          <span key={p.seat} className="flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1">
            <span className="h-3 w-3 rounded-full" style={{ background: SEAT_COLORS[p.seat] }} />
            {p.name} · {view.board.filter((x) => x?.seat === p.seat).length}
          </span>
        ))}
      </div>
    </div>
  );
}

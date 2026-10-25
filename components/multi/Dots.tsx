"use client";

import { BOXES, type DotsMove, type DotsState } from "@/lib/multiplayer/rules/dots";
import { useKeys } from "@/components/games/shared";
import { useState } from "react";
import { SEAT_COLORS, type TurnGameProps } from "./types";

const ALL_LINES: DotsMove[] = [
  ...Array.from({ length: BOXES + 1 }, (_, r) => Array.from({ length: BOXES }, (_, c) => ({ line: "h" as const, r, c }))).flat(),
  ...Array.from({ length: BOXES }, (_, r) => Array.from({ length: BOXES + 1 }, (_, c) => ({ line: "v" as const, r, c }))).flat(),
];

export default function Dots({ view, seat, turn, players, onMove, busy, local }: TurnGameProps<DotsState, DotsMove>) {
  const myTurn = seat !== null && turn.includes(seat) && !busy;
  const over = view.boxes.every((row) => row.every((b) => b !== -1));
  const name = (s: number) => players.find((p) => p.seat === s)?.name ?? `Player ${s + 1}`;
  const owner = (m: DotsMove) => (m.line === "h" ? view.h : view.v)[m.r][m.c];
  const free = ALL_LINES.filter((m) => owner(m) === -1);
  const [cursor, setCursor] = useState(-1);
  const draw = (m: DotsMove) => myTurn && owner(m) === -1 && onMove(m);

  useKeys((e) => {
    if (!myTurn || over || free.length === 0) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") setCursor((c) => (c + 1) % free.length);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") setCursor((c) => (c <= 0 ? free.length - 1 : c - 1));
    else if ((e.key === "Enter" || e.key === " ") && free[cursor]) draw(free[cursor]);
    else return;
    e.preventDefault();
  });
  const focused = free[cursor];

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
        ? "Your turn: draw a line"
        : `Waiting for ${name(view.turn)}…`;

  const U = 100 / BOXES; // percent per box
  const isLast = (m: DotsMove) => view.last?.line === m.line && view.last.r === m.r && view.last.c === m.c;

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="flex items-center gap-2 text-lg font-semibold" aria-live="polite">
        {!over && <span className="h-4 w-4 rounded-full" style={{ background: SEAT_COLORS[view.turn] }} />}
        {status}
      </p>
      <div className="flex flex-wrap justify-center gap-2 text-sm">
        {players.map((p) => (
          <span key={p.seat} className={`flex items-center gap-1.5 rounded-full border bg-panel px-3 py-1 ${view.turn === p.seat && !over ? "border-accent" : "border-line"}`}>
            <span className="h-3 w-3 rounded-full" style={{ background: SEAT_COLORS[p.seat] }} />
            {p.name}
            <span className="font-semibold tabular-nums">{view.scores[p.seat] ?? 0}</span>
          </span>
        ))}
      </div>
      <div className="touch-game relative aspect-square w-full max-w-[420px] p-[6%]" role="group" aria-label="Dots and Boxes. Arrow keys pick a line, Enter draws it.">
        <div className="relative h-full w-full">
          {view.boxes.map((row, r) =>
            row.map((b, c) =>
              b === -1 ? null : (
                <div
                  key={`b${r}-${c}`}
                  className="absolute flex items-center justify-center text-lg font-bold animate-pop"
                  style={{ left: `${c * U}%`, top: `${r * U}%`, width: `${U}%`, height: `${U}%`, background: `${SEAT_COLORS[b]}40`, color: SEAT_COLORS[b] }}
                >
                  {name(b)[0]?.toUpperCase()}
                </div>
              ),
            ),
          )}
          {ALL_LINES.map((m) => {
            const o = owner(m);
            const horizontal = m.line === "h";
            const style = horizontal
              ? { left: `${m.c * U}%`, top: `${m.r * U}%`, width: `${U}%`, height: "14%", transform: "translateY(-50%)" }
              : { left: `${m.c * U}%`, top: `${m.r * U}%`, width: "14%", height: `${U}%`, transform: "translateX(-50%)" };
            return (
              <button
                key={`${m.line}${m.r}-${m.c}`}
                type="button"
                tabIndex={-1}
                disabled={o !== -1 || !myTurn}
                onClick={() => draw(m)}
                aria-label={`${horizontal ? "Horizontal" : "Vertical"} line ${m.r + 1}, ${m.c + 1}${o === -1 ? "" : `, drawn by ${name(o)}`}`}
                className="group absolute flex items-center justify-center"
                style={style}
              >
                <span
                  className={`rounded-full transition-colors ${horizontal ? "h-[28%] w-[88%]" : "h-[88%] w-[28%]"} ${o === -1 ? (myTurn ? "bg-foreground/[.08] group-hover:bg-foreground/40" : "bg-foreground/[.06]") : ""} ${focused === m ? "!bg-accent" : ""} ${isLast(m) ? "animate-pop" : ""}`}
                  style={o === -1 ? undefined : { background: SEAT_COLORS[o] }}
                />
              </button>
            );
          })}
          {Array.from({ length: (BOXES + 1) ** 2 }, (_, i) => (
            <span
              key={`d${i}`}
              className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
              style={{ left: `${(i % (BOXES + 1)) * U}%`, top: `${Math.floor(i / (BOXES + 1)) * U}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

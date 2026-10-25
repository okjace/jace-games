"use client";

import { useState } from "react";
import { legalMoves, squareName, type ChessMove, type ChessState } from "@/lib/multiplayer/rules/chess";
import { useGridCursor } from "./GridCursor";
import type { TurnGameProps } from "./types";

const GLYPH: Record<string, string> = { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" };
const REASON: Record<string, string> = {
  checkmate: "Checkmate",
  stalemate: "Stalemate",
  fifty: "Draw by the 50-move rule",
  repetition: "Draw by repetition",
  material: "Draw: not enough pieces to mate",
};

export default function Chess({ view, seat, turn, players, onMove, busy, local }: TurnGameProps<ChessState, ChessMove>) {
  const [selected, setSelected] = useState<number | null>(null);
  const [promo, setPromo] = useState<{ from: number; to: number } | null>(null);
  const myTurn = seat !== null && turn.includes(seat) && !busy;
  const over = !!view.result;
  const flip = !local && seat === 1;
  const legal = myTurn && !over ? legalMoves(view, seat!) : [];
  const targets = legal.filter((m) => m.from === selected).map((m) => m.to);
  const name = (s: number) => players.find((p) => p.seat === s)?.name ?? (s === 0 ? "White" : "Black");
  const king = view.board.indexOf(view.turn === 0 ? "wK" : "bK");

  const pick = (cell: number) => {
    if (!myTurn || over) return;
    if (selected !== null && targets.includes(cell)) {
      if (legal.some((m) => m.from === selected && m.to === cell && m.promo)) setPromo({ from: selected, to: cell });
      else onMove({ from: selected, to: cell });
      setSelected(null);
      return;
    }
    const p = view.board[cell];
    setSelected(p && p[0] === (seat === 0 ? "w" : "b") && cell !== selected ? cell : null);
  };
  const { cursor } = useGridCursor(8, (c) => pick(flip ? 63 - c : c), myTurn && !over && !promo, 52);

  const status = over
    ? view.result!.winner === null
      ? REASON[view.result!.reason]
      : `${REASON[view.result!.reason]}! ${local ? `${name(view.result!.winner)} wins` : view.result!.winner === seat ? "You win" : `${name(view.result!.winner)} wins`}`
    : `${local ? `${view.turn === 0 ? "White" : "Black"} to move` : myTurn ? "Your move" : `Waiting for ${name(view.turn)}…`}${view.check ? " — check!" : ""}`;

  const pairs: string[] = [];
  for (let i = 0; i < view.moves.length; i += 2) pairs.push(`${i / 2 + 1}. ${view.moves[i]} ${view.moves[i + 1] ?? ""}`);

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-lg font-semibold" aria-live="polite">
        {status}
      </p>
      <div className="flex w-full max-w-[640px] flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="relative w-full max-w-[480px]">
          <div className="touch-game grid grid-cols-8 overflow-hidden rounded-2xl border border-line" role="grid" aria-label="Chess board. Arrow keys move, Enter picks a piece, then a square.">
            {Array.from({ length: 64 }, (_, shown) => {
              const i = flip ? 63 - shown : shown;
              const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
              const p = view.board[i];
              const last = view.last?.includes(i);
              const capture = targets.includes(i) && !!p;
              return (
                <button
                  key={i}
                  type="button"
                  tabIndex={-1}
                  onClick={() => pick(i)}
                  aria-label={`${squareName(i)} ${p ? `${p[0] === "w" ? "white" : "black"} ${({ K: "king", Q: "queen", R: "rook", B: "bishop", N: "knight", P: "pawn" } as Record<string, string>)[p[1]]}` : ""}`}
                  className={`relative flex aspect-square items-center justify-center ${dark ? "bg-[#769656]" : "bg-[#eeeed2]"} ${cursor === shown ? "ring-4 ring-inset ring-sky-400" : ""}`}
                >
                  {last && <span className="absolute inset-0 bg-yellow-300/40" />}
                  {selected === i && <span className="absolute inset-0 bg-sky-400/40" />}
                  {view.check && i === king && <span className="absolute inset-0 bg-red-500/50" />}
                  {p && (
                    <span
                      className="relative text-[min(9vw,44px)] leading-none select-none"
                      style={{ color: p[0] === "w" ? "#fff" : "#111", textShadow: p[0] === "w" ? "0 0 2px #000, 0 1px 1px #000" : "0 0 1px #fff" }}
                    >
                      {GLYPH[p[1]]}
                    </span>
                  )}
                  {targets.includes(i) && (
                    <span className={`absolute rounded-full ${capture ? "inset-1 border-4 border-black/30" : "h-1/4 w-1/4 bg-black/25"}`} />
                  )}
                </button>
              );
            })}
          </div>
          {promo && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-panel p-4">
                <p className="text-sm font-semibold">Promote to</p>
                <div className="flex gap-2">
                  {(["Q", "R", "B", "N"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      autoFocus={k === "Q"}
                      onClick={() => {
                        onMove({ ...promo, promo: k });
                        setPromo(null);
                      }}
                      className="flex h-14 w-14 items-center justify-center rounded-xl border border-line bg-background text-4xl hover:border-accent"
                    >
                      {GLYPH[k]}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setPromo(null)} className="text-xs text-muted hover:text-foreground">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="w-full rounded-2xl border border-line bg-panel p-3 text-sm sm:w-40">
          <div className="mb-2 space-y-1">
            {players.slice(0, 2).map((p) => (
              <p key={p.seat} className="flex items-center gap-2">
                <span className="text-lg">{p.seat === 0 ? "♔" : "♚"}</span>
                <span className="truncate">{p.name}</span>
              </p>
            ))}
          </div>
          <ol className="max-h-48 overflow-y-auto font-mono text-xs text-muted sm:max-h-80">
            {pairs.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

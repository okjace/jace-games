"use client";

import { useState } from "react";
import { FLEET, SIZE, randomFleet, shipCells, validFleet, type BattleshipMove, type BattleshipView, type Ship } from "@/lib/multiplayer/rules/battleship";
import { useGridCursor } from "./GridCursor";
import { PassScreen, usePassScreen } from "./PassScreen";
import type { TurnGameProps } from "./types";

const LETTERS = "ABCDEFGHIJ";
const cellName = (c: number) => `${LETTERS[c % SIZE]}${Math.floor(c / SIZE) + 1}`;

export default function Battleship(props: TurnGameProps<BattleshipView, BattleshipMove>) {
  const { view, seat, players, local } = props;
  const name = (s: number) => players.find((p) => p.seat === s)?.name ?? `Player ${s + 1}`;
  const pass = usePassScreen(local, seat);
  if (pass.covered && seat !== null) return <PassScreen name={name(seat)} onReveal={pass.reveal} />;
  return view.phase === "place" && seat !== null && !view.placed[seat] ? <Placement key={seat} {...props} /> : <Battle {...props} />;
}

function Grid({
  label,
  ships,
  shots,
  onCell,
  cursor,
  highlight,
}: {
  label: string;
  ships: Ship[];
  shots: { cell: number; hit: boolean }[];
  onCell?: (c: number) => void;
  cursor?: number;
  highlight?: number[];
}) {
  const shipAt = new Set(ships.flatMap(shipCells));
  const shotAt = new Map(shots.map((s) => [s.cell, s.hit]));
  return (
    <div className="w-full max-w-[360px]">
      <p className="mb-1.5 text-sm font-semibold">{label}</p>
      <div className="touch-game grid grid-cols-10 gap-[2px] rounded-xl border border-line bg-[#0b3a5c] p-1" role="grid" aria-label={label}>
        {Array.from({ length: SIZE * SIZE }, (_, c) => {
          const shot = shotAt.get(c);
          return (
            <button
              key={c}
              type="button"
              tabIndex={-1}
              disabled={!onCell || shot !== undefined}
              onClick={() => onCell?.(c)}
              aria-label={`${cellName(c)}${shipAt.has(c) ? ", ship" : ""}${shot === undefined ? "" : shot ? ", hit" : ", miss"}`}
              className={`relative flex aspect-square items-center justify-center rounded-[3px] text-xs ${
                shipAt.has(c) ? "bg-[#94a3b8]" : "bg-[#1e5a85]"
              } ${highlight?.includes(c) ? "ring-2 ring-inset ring-accent" : ""} ${cursor === c ? "ring-2 ring-inset ring-warn" : ""} ${onCell && shot === undefined ? "hover:bg-[#2b75a8]" : ""}`}
            >
              {shot === true && <span className="text-sm">💥</span>}
              {shot === false && <span className="h-1.5 w-1.5 rounded-full bg-white/70" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Placement({ onMove, busy }: TurnGameProps<BattleshipView, BattleshipMove>) {
  const [ships, setShips] = useState<Ship[]>(() => randomFleet());
  const [sel, setSel] = useState<number | null>(null);
  const onCell = (c: number) => {
    const hit = ships.findIndex((s) => shipCells(s).includes(c));
    if (sel === null) {
      setSel(hit >= 0 ? hit : null);
      return;
    }
    if (hit === sel) {
      // Tap the selected ship again to rotate it.
      const s = ships[sel];
      const rotated = [...ships];
      rotated[sel] = { ...s, dir: s.dir === "h" ? "v" : "h" };
      if (validFleet(rotated)) setShips(rotated);
      return;
    }
    // Move the selected ship so it starts at this square.
    const moved = [...ships];
    moved[sel] = { ...ships[sel], x: c % SIZE, y: Math.floor(c / SIZE) };
    if (validFleet(moved)) {
      setShips(moved);
      setSel(null);
    } else if (hit >= 0) setSel(hit);
  };
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-lg font-semibold">Place your fleet</p>
      <p className="max-w-sm text-center text-sm text-muted">Tap a ship to pick it, tap a square to move it there, or tap it again to turn it. Ships: {FLEET.join(", ")}.</p>
      <Grid label="Your fleet" ships={ships} shots={[]} onCell={onCell} highlight={sel !== null ? shipCells(ships[sel]) : []} />
      <div className="flex gap-2">
        <button type="button" onClick={() => (setShips(randomFleet()), setSel(null))} className="inline-flex h-10 items-center rounded-full border border-line bg-panel px-5 text-sm font-medium hover:bg-foreground/[.05]">
          🔀 Shuffle
        </button>
        <button type="button" disabled={busy} onClick={() => onMove({ place: ships })} className="inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-60">
          Ready
        </button>
      </div>
    </div>
  );
}

function Battle({ view, seat, turn, players, onMove, busy, local }: TurnGameProps<BattleshipView, BattleshipMove>) {
  const myTurn = seat !== null && turn.includes(seat) && !busy && view.phase === "fire";
  const name = (s: number) => players.find((p) => p.seat === s)?.name ?? `Player ${s + 1}`;
  const other = seat === null ? 1 : 1 - seat;
  const fire = (c: number) => myTurn && !view.myShots.some((s) => s.cell === c) && onMove({ fire: c });
  const { cursor } = useGridCursor(SIZE, fire, myTurn, 55);
  const last = view.last;
  const status =
    view.phase === "over"
      ? local
        ? `${name(view.winner!)} sank every ship!`
        : view.winner === seat
          ? "You sank their fleet! 🎉"
          : `${name(view.winner!)} sank your fleet.`
      : view.phase === "place"
        ? "Waiting for the other fleet…"
        : myTurn
          ? "Your turn: fire!"
          : `${name(view.turn)} is aiming…`;
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-lg font-semibold" aria-live="polite">
        {status}
      </p>
      {last && view.phase !== "place" && (
        <p className="text-sm text-muted" aria-live="polite">
          {last.seat === seat ? "You" : name(last.seat)} fired at {cellName(last.cell)}: {last.sunk ? "sunk a ship!" : last.hit ? "hit!" : "miss."}
        </p>
      )}
      <div className="flex w-full flex-col items-center gap-4 md:flex-row md:items-start md:justify-center">
        <Grid label={`${name(other)}'s waters`} ships={view.theirShips} shots={view.myShots} onCell={myTurn ? fire : undefined} cursor={myTurn ? cursor : -1} />
        <Grid label="Your fleet" ships={view.myShips} shots={view.theirShots} />
      </div>
    </div>
  );
}

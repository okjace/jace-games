"use client";

import { useState } from "react";
import { TURN_COMPONENTS } from "@/components/multi";
import { useLocalGame } from "@/lib/multiplayer/local";
import type { MultiplayerDef } from "@/lib/games";

/** Pass-and-play for turn-based games: everyone shares this device, no account needed. */
export function LocalPlay({ gameId, multiplayer }: { gameId: string; multiplayer: MultiplayerDef }) {
  const [seats, setSeats] = useState(multiplayer.min);
  return <LocalGame key={seats} gameId={gameId} seats={seats} setSeats={setSeats} multiplayer={multiplayer} />;
}

function LocalGame({
  gameId,
  seats,
  setSeats,
  multiplayer,
}: {
  gameId: string;
  seats: number;
  setSeats: (n: number) => void;
  multiplayer: MultiplayerDef;
}) {
  const Board = TURN_COMPONENTS[gameId];
  const game = useLocalGame(gameId, seats);
  const turn = game.status.over ? [] : game.status.turn;
  const seat = turn[0] ?? null;
  const players = Array.from({ length: seats }, (_, i) => ({ seat: i, name: `Player ${i + 1}` }));
  if (!Board) return null;
  return (
    <div className="flex flex-col items-center gap-4">
      <Board view={game.view(seat)} seat={seat} turn={turn} players={players} busy={false} local onMove={(m) => seat !== null && game.move(seat, m)} />
      {game.error && <p className="text-sm text-danger">{game.error}</p>}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={game.reset}
          className="inline-flex h-10 items-center rounded-full border border-line bg-panel px-5 text-sm font-medium hover:bg-foreground/[.05]"
        >
          {game.status.over ? "Play again" : "Restart"}
        </button>
        {multiplayer.max > multiplayer.min && (
          <label className="flex items-center gap-2 text-sm text-muted">
            Players
            <select
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
              className="h-10 rounded-full border border-line bg-panel px-3 text-foreground"
            >
              {Array.from({ length: multiplayer.max - multiplayer.min + 1 }, (_, i) => multiplayer.min + i).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}

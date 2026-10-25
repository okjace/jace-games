"use client";

import { useState } from "react";

/**
 * Pass-and-play for games with secrets (Battleship): covers the board
 * between turns so the next player doesn't see the last player's view.
 */
export function usePassScreen(local: boolean, seat: number | null) {
  const [shown, setShown] = useState<number | null>(null);
  const covered = local && seat !== null && seat !== shown;
  return { covered, reveal: () => setShown(seat) };
}

export function PassScreen({ name, onReveal }: { name: string; onReveal: () => void }) {
  return (
    <div className="flex min-h-72 w-full max-w-md flex-col items-center justify-center gap-4 rounded-2xl border border-line bg-panel p-8 text-center">
      <p className="text-4xl">🙈</p>
      <p className="text-xl font-bold">Pass the device to {name}</p>
      <p className="text-sm text-muted">No peeking, everyone else!</p>
      <button
        type="button"
        autoFocus
        onClick={onReveal}
        className="inline-flex h-11 items-center rounded-full bg-accent px-6 text-sm font-semibold text-on-accent hover:bg-accent-hover"
      >
        I&apos;m {name}, show my board
      </button>
    </div>
  );
}

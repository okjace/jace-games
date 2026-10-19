"use client";

import { useMemo } from "react";
import { useScores } from "@/components/ScoresProvider";
import { GAMES, compareScores, type GameDef } from "./games";
import type { ScoreEntry } from "./types";

/** The player's best score for every game (from Jace and this device). */
export function useBests(): Record<string, ScoreEntry | undefined> {
  const { history } = useScores();
  return useMemo(() => {
    const out: Record<string, ScoreEntry | undefined> = {};
    for (const game of GAMES) out[game.id] = bestOf(game, history);
    return out;
  }, [history]);
}

export function bestOf(game: GameDef, history: ScoreEntry[]): ScoreEntry | undefined {
  return history.filter((s) => s.game === game.id).sort(compareScores(game))[0];
}

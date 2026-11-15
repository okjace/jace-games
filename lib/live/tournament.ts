import { MODES, type LiveMode } from "./types";

/**
 * Tournaments: the host lines up 2–6 game modes and everyone plays them back
 * to back with the same game code. After each round players (and teams) get
 * tournament points by place; the most points after the last round wins.
 */

export const MAX_ROUNDS = 6;
/** Points for 1st, 2nd, 3rd…; everyone further down gets 1 for playing. */
export const PLACE_POINTS = [10, 8, 6, 5, 4, 3, 2];
export const pointsFor = (place: number) => PLACE_POINTS[place - 1] ?? 1;

export type Tournament = {
  rounds: LiveMode[];
  /** The round being played (0-based). */
  round: number;
  /** Teams' tournament points (games with teams), by team number. */
  teamPoints?: number[];
  /** Rounds already scored (so a round never counts twice). */
  scored?: number;
};

/** Modes that can't be tournament rounds: they need a special set or a Studio game. */
const NOT_IN_TOURNAMENTS: LiveMode[] = ["custom", "rare"];

/** A lineup from the host: 2–6 known modes, none that need questions when there's no set. */
export function cleanTournament(raw: unknown, noSet: boolean): Tournament | null {
  if (!raw || typeof raw !== "object") return null;
  const list = (raw as { rounds?: unknown }).rounds;
  if (!Array.isArray(list)) return null;
  const rounds = list.filter((m): m is LiveMode => typeof m === "string" && m in MODES && !NOT_IN_TOURNAMENTS.includes(m as LiveMode) && !(noSet && MODES[m as LiveMode].needsSet)).slice(0, MAX_ROUNDS);
  return rounds.length >= 2 ? { rounds, round: 0 } : null;
}


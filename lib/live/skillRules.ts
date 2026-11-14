/**
 * Six skill modes for Live. A right answer (or a tap, with questions off)
 * earns moves; what you do with them is all skill: strategy, logic, memory
 * and timing. The server keeps the secrets (vault codes, card faces, mines)
 * and decides every result. This file is the shared part: rules, numbers
 * and what each player's screen gets. The server logic is in skillModes.ts.
 */

export const SKILL_MODES = ["territory", "vault", "king", "memory", "sweep", "stack"] as const;
export type SkillMode = (typeof SKILL_MODES)[number];
export const isSkillMode = (m: string): m is SkillMode => (SKILL_MODES as readonly string[]).includes(m);

/** Moves are capped so nobody can hoard a pile and dump it at the end. */
export const MAX_MOVES = 12;

/** Moves for one right answer. Streaks of 3+ earn extra in the modes where speed matters. */
export function movesFor(mode: SkillMode, streak: number): number {
  const hot = streak >= 3;
  if (mode === "sweep") return hot ? 4 : 3;
  if (mode === "territory" || mode === "king") return hot ? 2 : 1;
  return 1;
}

// ---------- Territory Wars ----------

export const TERRITORY_SIZE = 10;
/** Claiming someone else's square costs this many moves. */
export const STEAL_COST = 2;

// ---------- Vault Cracker ----------

export const VAULT_SYMBOLS = ["🔴", "🟡", "🟢", "🔵", "🟣", "🟠"];
export const VAULT_LENGTH = 4;
/** Points for cracking a vault in n guesses. */
export const vaultPoints = (guesses: number) => Math.max(20, 100 - (guesses - 1) * 12);

// ---------- King of the Hill ----------

export const KING_START_SHIELD = 3;
export const KING_MAX_SHIELD = 8;

// ---------- Memory Match ----------

export const MEMORY_FACES = ["🦊", "🐼", "🐙", "🦄", "🐸", "🦉", "🐢", "🦋", "🐝", "🦀", "🐳", "🦜", "🐌", "🦔", "🐞", "🦩"];
/** Pairs on each board: it grows as you clear them. */
export const memoryPairs = (level: number) => Math.min(12, 6 + (level - 1) * 2);
export const MEMORY_MATCH = 10;
export const MEMORY_COMBO = 5;
export const memoryClear = (level: number) => 40 * level;

// ---------- Minefield ----------

export const SWEEP_SIZE = 8;
export const SWEEP_MINES = 10;
export const SWEEP_CLEAR = 60;
export const SWEEP_BOOM = 20;

// ---------- Sky Stacker ----------

/** Block widths are percentages of the tower's lane. */
export const STACK_START_WIDTH = 60;
/** How close (in %) counts as a perfect drop. */
export const STACK_PERFECT = 2;
/** One full swing across and back, in ms: faster as the tower grows. */
export const stackPeriod = (height: number) => Math.max(800, 2400 - height * 90);

/** Where a swinging block is (its left edge, %) t ms after it appeared: it bounces between the walls. */
export function stackPos(t: number, width: number, period: number): number {
  const span = 100 - width;
  const phase = (((t % period) + period) % period) / period;
  const tri = phase < 0.5 ? phase * 2 : 2 - phase * 2;
  return tri * span;
}

// ---------- What a player sees ----------

export type SkillView = {
  mode: SkillMode;
  moves: number;
  territory?: {
    size: number;
    /** Owner of each square: an index into `players`, or -1. */
    cells: number[];
    players: { name: string; color: string; count: number; you: boolean }[];
    /** Squares that can't be stolen (boxed in by their owner's land). */
    safe: number[];
  };
  vault?: { length: number; symbols: number; guesses: { g: number[]; exact: number; near: number }[]; cracked: number };
  king?: { king: { name: string; you: boolean; shield: number; since: number } | null; heldMs: number; maxShield: number };
  memory?: { faces: (string | null)[]; open: number[]; level: number; combo: number; pairs: number };
  sweep?: { size: number; mines: number; cells: (number | null)[]; flags: number[]; boards: number };
  stack?: { blocks: { x: number; w: number }[]; block: { width: number; period: number; age: number } | null; best: number };
};

export const PLAYER_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#f97316", "#14b8a6", "#ec4899", "#84cc16", "#06b6d4", "#f43f5e", "#8b5cf6"];

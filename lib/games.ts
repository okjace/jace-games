/**
 * Every game in Jace Games. Adding a game is one entry here plus its
 * component (components/games/<Name>.tsx, registered in components/games/index.ts).
 *
 * `id` is what Jace stores scores under, so never change an existing one:
 * "snake" and "memory" are the ids the original Jace site used, which is how
 * old scores carry over. Ids are lowercase letters, numbers and dashes.
 *
 * `limits` are checked on the server before a score is sent to Jace (see
 * lib/validate.ts): the score must be a whole number in [min, max], and the
 * game must have lasted at least `minDurationMs(score)`.
 */

export type Better = "higher" | "lower";

export type GameDef = {
  id: string;
  name: string;
  description: string;
  icon: string;
  better: Better;
  /** Short label for the score, shown in tables ("Food", "Moves"). */
  scoreLabel: string;
  /** Formats a score for display. */
  format: (score: number) => string;
  /** When the game was added to Jace Games (YYYY-MM-DD); drives the "New" badge. */
  addedAt: string;
  limits: {
    min: number;
    max: number;
    /** The shortest plausible game, in ms, that could earn this score. */
    minDurationMs: (score: number) => number;
  };
};

const n = (v: number) => v.toLocaleString("en-US");

export const GAMES: GameDef[] = [
  {
    id: "snake",
    name: "Snake",
    description: "Eat, grow, and don't bite your own tail.",
    icon: "🐍",
    better: "higher",
    scoreLabel: "Food",
    format: (s) => `${n(s)} food`,
    addedAt: "2025-01-01",
    // 20×20 board; the snake moves at most one cell every 70 ms.
    limits: { min: 0, max: 399, minDurationMs: (s) => s * 70 },
  },
  {
    id: "memory",
    name: "Memory Match",
    description: "Flip cards and find all eight pairs in as few moves as you can.",
    icon: "🃏",
    better: "lower",
    scoreLabel: "Moves",
    format: (s) => `${n(s)} moves`,
    addedAt: "2025-01-01",
    limits: { min: 8, max: 999, minDurationMs: (s) => s * 250 },
  },
  {
    id: "2048",
    name: "2048",
    description: "Slide and merge tiles to reach 2048 — then keep going.",
    icon: "🔢",
    better: "higher",
    scoreLabel: "Score",
    format: (s) => n(s),
    addedAt: "2026-10-19",
    limits: { min: 0, max: 4_000_000, minDurationMs: (s) => s * 1.5 },
  },
  {
    id: "tetris",
    name: "Block Stacker",
    description: "Falling blocks. Clear lines, level up, don't top out.",
    icon: "🧱",
    better: "higher",
    scoreLabel: "Score",
    format: (s) => n(s),
    addedAt: "2026-10-19",
    limits: { min: 0, max: 2_000_000, minDurationMs: (s) => s * 0.4 },
  },
  {
    id: "minesweeper",
    name: "Minesweeper",
    description: "Clear the 9×9 field without hitting one of the 10 mines.",
    icon: "💣",
    better: "lower",
    scoreLabel: "Time",
    format: (s) => `${n(s)}s`,
    addedAt: "2026-10-19",
    limits: { min: 1, max: 9_999, minDurationMs: (s) => s * 900 },
  },
  {
    id: "flappy",
    name: "Flappy Jace",
    description: "Tap to flap through the gaps. One touch and it's over.",
    icon: "🐤",
    better: "higher",
    scoreLabel: "Pipes",
    format: (s) => `${n(s)} pipes`,
    addedAt: "2026-10-19",
    // A new pipe arrives every ~1.4 s.
    limits: { min: 0, max: 9_999, minDurationMs: (s) => s * 1_200 },
  },
  {
    id: "breakout",
    name: "Breakout",
    description: "Bounce the ball, smash every brick, keep the paddle moving.",
    icon: "🏓",
    better: "higher",
    scoreLabel: "Score",
    format: (s) => n(s),
    addedAt: "2026-10-19",
    limits: { min: 0, max: 99_999, minDurationMs: (s) => s * 8 },
  },
  {
    id: "wordle",
    name: "Word Guess",
    description: "Find the hidden five-letter word in six guesses or fewer.",
    icon: "🔤",
    better: "lower",
    scoreLabel: "Guesses",
    format: (s) => `${s}/6`,
    addedAt: "2026-10-19",
    limits: { min: 1, max: 6, minDurationMs: (s) => s * 1_000 },
  },
  {
    id: "reaction",
    name: "Reaction Time",
    description: "Wait for green, then tap. Your average of five tries counts.",
    icon: "⚡",
    better: "lower",
    scoreLabel: "Average",
    format: (s) => `${n(s)} ms`,
    addedAt: "2026-10-19",
    // Faster than ~100 ms is anticipation, not reaction.
    limits: { min: 100, max: 5_000, minDurationMs: () => 5 * 1_000 },
  },
  {
    id: "typing",
    name: "Typing Speed",
    description: "Type as many words as you can in 30 seconds.",
    icon: "⌨️",
    better: "higher",
    scoreLabel: "WPM",
    format: (s) => `${n(s)} WPM`,
    addedAt: "2026-10-19",
    limits: { min: 0, max: 250, minDurationMs: () => 29_000 },
  },
];

export function getGame(id: string): GameDef | undefined {
  return GAMES.find((g) => g.id === id);
}

/** True if `a` is a better score than `b` for this game. */
export function isBetter(game: Pick<GameDef, "better">, a: number, b: number): boolean {
  return game.better === "higher" ? a > b : a < b;
}

/** Sorts best first. */
export function compareScores(game: Pick<GameDef, "better">) {
  return (a: { score: number }, b: { score: number }) =>
    game.better === "higher" ? b.score - a.score : a.score - b.score;
}

const NEW_FOR_MS = 31 * 24 * 60 * 60 * 1000;

/** Added in the last month. */
export function isNewGame(game: GameDef, now = Date.now()): boolean {
  return now - Date.parse(`${game.addedAt}T00:00:00Z`) < NEW_FOR_MS;
}

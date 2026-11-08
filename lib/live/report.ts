import type { Avatar } from "./locker";

/**
 * A host's report for a Live game: every question, and exactly what each
 * player chose. Built from the live game while it exists, and saved when the
 * game ends so the host can see it later (supabase/migrations/010_live_reports.sql).
 */

export type ReportQuestion = {
  prompt: string;
  type: string;
  /** For multiple choice and true/false: the options, in order. */
  choices: string[] | null;
  /** The right answer(s), as words. */
  right: string;
};

/** One try at a question. Self-paced modes can see a question more than once. */
export type ReportAttempt = { yours: string; correct: boolean };

export type ReportPlayer = {
  name: string;
  avatar: Avatar | null;
  score: number;
  correct: number;
  answered: number;
  /** answers[q] = this player's tries at question q (empty if they never got it). */
  answers: ReportAttempt[][];
};

export type GameReport = {
  code: string;
  mode: string;
  modeName: string;
  setTitle: string | null;
  /** A solo game: the one player is the person who made it. */
  solo?: boolean;
  status: "lobby" | "playing" | "ended";
  startedAt: string | null;
  endedAt: string | null;
  questions: ReportQuestion[];
  players: ReportPlayer[];
};

export type ReportSummary = {
  id: string;
  code: string;
  modeName: string;
  setTitle: string | null;
  endedAt: string;
  players: number;
  questions: number;
  solo: boolean;
  /** Solo: how many tries were right, out of how many. */
  right?: number;
  answered?: number;
};

/** Share of tries at question q that were right (null if nobody tried it). */
export function percentRight(r: GameReport, q: number): number | null {
  const tries = r.players.flatMap((p) => p.answers[q] ?? []);
  if (tries.length === 0) return null;
  return Math.round((tries.filter((t) => t.correct).length / tries.length) * 100);
}

/** A spreadsheet of the report: one row per player, one column per question. */
export function reportCsv(r: GameReport): string {
  const cell = (v: string | number) => {
    const s = String(v);
    // Quote everything, and stop spreadsheet apps treating a cell as a formula.
    return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  const head = ["Player", "Score", "Right", "Answered", ...r.questions.map((q, i) => `Q${i + 1}: ${q.prompt}`)];
  const key = ["Right answer", "", "", "", ...r.questions.map((q) => q.right)];
  const rows = r.players.map((p) => [
    p.name,
    p.score,
    p.correct,
    p.answered,
    ...r.questions.map((_, i) =>
      (p.answers[i] ?? []).map((a) => `${a.correct ? "✓" : "✗"} ${a.yours}`).join(" | "),
    ),
  ]);
  return [head, key, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}

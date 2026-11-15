/**
 * Teams for any Live game: up to 12 teams, each with its own name, emoji and
 * colour. The host picks how people end up on a team: players pick in the
 * lobby, the host puts them on one, or random (kept even). Anyone without a
 * team when the game starts goes on the smallest one. A team's score is its
 * players' scores added up.
 */

export const TEAMS = [
  { name: "Foxes", icon: "🦊", color: "#f97316" },
  { name: "Squids", icon: "🦑", color: "#ec4899" },
  { name: "Rockets", icon: "🚀", color: "#3b82f6" },
  { name: "Frogs", icon: "🐸", color: "#22c55e" },
  { name: "Bees", icon: "🐝", color: "#eab308" },
  { name: "Ghosts", icon: "👻", color: "#a855f7" },
  { name: "Sharks", icon: "🦈", color: "#0ea5e9" },
  { name: "Dragons", icon: "🐉", color: "#ef4444" },
  { name: "Penguins", icon: "🐧", color: "#64748b" },
  { name: "Cactuses", icon: "🌵", color: "#16a34a" },
  { name: "Donuts", icon: "🍩", color: "#f472b6" },
  { name: "Robots", icon: "🤖", color: "#14b8a6" },
] as const;

export const MAX_TEAMS = TEAMS.length;
export type TeamPick = "players" | "host" | "random";
export type TeamSettings = { count: number; pick: TeamPick };

/** Team settings from the host (null = no teams). */
export function cleanTeams(raw: unknown): TeamSettings | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const count = Math.round(Number(r.count));
  if (!Number.isFinite(count) || count < 2) return null;
  const pick: TeamPick = r.pick === "host" || r.pick === "random" ? r.pick : "players";
  return { count: Math.min(MAX_TEAMS, count), pick };
}

/** A valid team number for this game, or null. */
export const teamIndex = (t: TeamSettings | null | undefined, v: unknown): number | null => {
  const n = Number(v);
  return t && Number.isInteger(n) && n >= 0 && n < t.count ? n : null;
};

/** The team with the fewest players (the first one on a tie). */
export function smallestTeam(t: TeamSettings, members: (number | null | undefined)[]): number {
  const counts = Array.from({ length: t.count }, () => 0);
  for (const m of members) if (m !== null && m !== undefined && m < t.count) counts[m]++;
  let best = 0;
  for (let i = 1; i < counts.length; i++) if (counts[i] < counts[best]) best = i;
  return best;
}

/** Everyone spread evenly over the teams, in a random order. */
export function shuffledTeams(t: TeamSettings, ids: string[]): Map<string, number> {
  const order = [...ids];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  // Start the count on a random team, so small games don't always fill team 1 first.
  const start = Math.floor(Math.random() * t.count);
  return new Map(order.map((id, i) => [id, (start + i) % t.count]));
}

export type TeamScore = { team: number; name: string; icon: string; color: string; score: number; players: number; rank: number };

/** Each team's total and place (biggest total first; ties share a place). */
export function teamScores(t: TeamSettings, players: { team: number | null; score: number }[]): TeamScore[] {
  const rows = Array.from({ length: t.count }, (_, i) => ({ team: i, ...TEAMS[i], score: 0, players: 0, rank: 0 }));
  for (const p of players) {
    if (p.team === null || !rows[p.team]) continue;
    rows[p.team].score += p.score;
    rows[p.team].players++;
  }
  const sorted = [...rows].sort((a, b) => b.score - a.score || a.team - b.team);
  sorted.forEach((r, i) => (r.rank = i > 0 && r.score === sorted[i - 1].score ? sorted[i - 1].rank : i + 1));
  return sorted;
}

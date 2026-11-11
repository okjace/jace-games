import { closeEnough, normAnswer, type Question } from "./types";

/**
 * Rare Finds: open "name a ..." prompts where any fitting answer counts, and
 * rarer answers score more. Each player gets ROUNDS random prompts with
 * SECONDS each and can keep guessing until the time runs out. A prompt's
 * answers carry a rarity tier (1–5) in Question.rarity.
 */

export const RARE_ROUNDS = 7;
export const RARE_SECONDS = 25;

export const RARE_TIERS: Record<number, { name: string; icon: string; points: number; color: string }> = {
  1: { name: "Common", icon: "🪨", points: 10, color: "#a3a3a3" },
  2: { name: "Uncommon", icon: "🥉", points: 25, color: "#d97706" },
  3: { name: "Rare", icon: "🥈", points: 50, color: "#94a3b8" },
  4: { name: "Epic", icon: "🥇", points: 75, color: "#facc15" },
  5: { name: "Legendary", icon: "💎", points: 100, color: "#38bdf8" },
};

/** A set can play Rare Finds when at least five of its typed-answer questions have rarity tiers. */
export function isRareSet(questions: Question[] | null | undefined): boolean {
  return (questions ?? []).filter((q) => q.type === "type" && q.rarity && Object.keys(q.rarity).length >= 3).length >= 5;
}

/** Which accepted answer a guess matches (typos forgiven), and its tier. */
export function rareMatch(q: Question, typed: string): { answer: string; tier: number } | null {
  const accepted = q.accepted ?? [];
  const exact = accepted.find((a) => normAnswer(a) === normAnswer(typed));
  const hit = exact ?? accepted.find((a) => closeEnough(typed, a));
  if (!hit) return null;
  const tier = q.rarity?.[normAnswer(hit)] ?? 1;
  return { answer: hit, tier: Math.min(5, Math.max(1, tier)) };
}

/** The rarest few answers to a prompt, to show after it ("you could have said…"). */
export function rarestAnswers(q: Question, n = 3): { answer: string; tier: number }[] {
  return (q.accepted ?? [])
    .map((a) => ({ answer: a, tier: q.rarity?.[normAnswer(a)] ?? 1 }))
    .sort((a, b) => b.tier - a.tier)
    .slice(0, n);
}

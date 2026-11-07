import "server-only";
import { createHash, randomInt } from "crypto";
import type { LiveMode } from "./types";

/**
 * The party modes of Jace Games Live (all original games):
 *
 * - Tower Siege, Snack Shack and Gadget Factory run their mini-game on the
 *   player's device. A right answer (or a tap, with questions off) puts
 *   coins or food in the player's "bank" here on the server, and the score
 *   the device reports can never be more than that bank could plausibly
 *   have earned.
 * - Lake Frenzy and Code Breakers are decided entirely here: what you catch,
 *   how many bits you mine, and whether a hack works.
 */

export type Catch = { icon: string; name: string; weight: number; kind: "fish" | "junk" | "frenzy" | "storm" };

export type PartyData = {
  /** Device modes: everything earned so far (coins or food units). */
  bank?: number;
  /** Lake Frenzy: the last few catches, frenzy casts left, and a storm hanging over you. */
  catches?: Catch[];
  frenzy?: number;
  stormed?: string | null;
  /** Code Breakers. */
  pw?: string;
  hackCharge?: number;
  hackReady?: boolean;
  hack?: { target: string; targetName: string; options: string[]; answer: number } | null;
};

export const TAP_COOLDOWN_MS: Record<LiveMode, number> = {
  classic: 0,
  gold: 1200,
  rocket: 650,
  tower: 900,
  snack: 900,
  factory: 900,
  fishing: 1500,
  hack: 1200,
};

// ---------- Device modes ----------

/** What one right answer (or one tap) earns. */
export function reward(mode: LiveMode, streak: number, tap: boolean): number {
  if (mode === "tower") return tap ? 4 : 10 + Math.min(streak, 10) * 2;
  if (mode === "snack") return tap ? 2 : 4 + Math.floor(Math.min(streak, 9) / 3);
  if (mode === "factory") return tap ? 5 : 15 + Math.min(streak, 10) * 3;
  return 0;
}

/**
 * The most a device-mode score can be. Generous on purpose (the games have
 * upgrades), but it stops a tampered page from posting a huge number.
 */
export function scoreCap(mode: LiveMode, bank: number, elapsedSec: number): number {
  if (mode === "tower") return Math.round(bank * 15 + 300); // waves and kills cost coins to reach
  if (mode === "snack") return Math.round(bank * 40); // the best upgraded price per item
  if (mode === "factory") return Math.round(bank * 0.3 * elapsedSec + bank * 20); // machines turn coins into gadgets per second
  return 0;
}

// ---------- Lake Frenzy ----------

const LAKE: { w: number; c: () => Catch }[] = [
  { w: 300, c: () => ({ icon: "🐟", name: "Minnow", weight: randomInt(1, 4), kind: "fish" }) },
  { w: 250, c: () => ({ icon: "🐠", name: "Sunfish", weight: randomInt(3, 9), kind: "fish" }) },
  { w: 120, c: () => ({ icon: "🐡", name: "Puffer", weight: randomInt(5, 13), kind: "fish" }) },
  { w: 80, c: () => ({ icon: "🦑", name: "Squid", weight: randomInt(10, 26), kind: "fish" }) },
  { w: 50, c: () => ({ icon: "🐢", name: "Old Turtle", weight: randomInt(20, 46), kind: "fish" }) },
  { w: 20, c: () => ({ icon: "🦈", name: "Lake Shark", weight: randomInt(60, 121), kind: "fish" }) },
  { w: 5, c: () => ({ icon: "🐋", name: "Legendary Whale", weight: randomInt(150, 301), kind: "fish" }) },
  { w: 80, c: () => ({ icon: "🥾", name: "Soggy Boot", weight: 0, kind: "junk" }) },
  { w: 50, c: () => ({ icon: "🫧", name: "Frenzy!", weight: 0, kind: "frenzy" }) },
  { w: 45, c: () => ({ icon: "⛈️", name: "Storm Cloud", weight: 0, kind: "storm" }) },
];
const LAKE_TOTAL = LAKE.reduce((a, b) => a + b.w, 0);

/** One cast. A streak is a better lure; frenzy doubles the next 3 catches; being stormed halves one. */
export function cast(streak: number, frenzy: number, stormed: boolean): Catch {
  let r = randomInt(LAKE_TOTAL);
  let pick = LAKE[0];
  for (const entry of LAKE) {
    if (r < entry.w) {
      pick = entry;
      break;
    }
    r -= entry.w;
  }
  const c = pick.c();
  if (c.kind === "fish") {
    let w = c.weight * (1 + Math.min(streak, 5) * 0.1);
    if (frenzy > 0) w *= 2;
    if (stormed) w /= 2;
    c.weight = Math.max(1, Math.round(w));
  }
  return c;
}

// ---------- Code Breakers ----------

const WORDS = [
  "pickle", "rocket", "banana", "turtle", "laser", "pixel", "waffle", "cactus", "comet", "noodle", "falcon", "marble",
  "pretzel", "glacier", "jelly", "thunder", "muffin", "nebula", "walrus", "tornado", "kiwi", "lantern", "taco", "zebra",
  "mango", "orbit", "pancake", "quartz", "sprout", "violet", "yeti", "zipper", "biscuit", "dragon", "ember", "gizmo",
];

/** The three passwords a player can choose from (stable per player, no database write needed). */
export function passwordChoices(gameId: string, playerId: string): string[] {
  const h = createHash("sha256").update(`${gameId}:${playerId}`).digest();
  const picks: string[] = [];
  for (let i = 0; picks.length < 3 && i < h.length; i++) {
    const w = WORDS[h[i] % WORDS.length];
    if (!picks.includes(w)) picks.push(w);
  }
  return picks;
}

/** Mining after a right answer (or a tap). */
export function mine(streak: number, tap: boolean): number {
  const base = tap ? randomInt(3, 9) : randomInt(5, 31);
  return Math.round(base * (1 + Math.min(streak, 5) * 0.1));
}

/** Three passwords for a hack attempt: the real one and two decoys, shuffled. */
export function hackOptions(real: string): { options: string[]; answer: number } {
  const decoys = WORDS.filter((w) => w !== real);
  const a = decoys[randomInt(decoys.length)];
  let b = decoys[randomInt(decoys.length)];
  while (b === a) b = decoys[randomInt(decoys.length)];
  const options = [real, a, b];
  for (let i = options.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { options, answer: options.indexOf(real) };
}

/** Right answers needed before you can try a hack. */
export const HACK_EVERY = 3;

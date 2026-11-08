import "server-only";
import { createHash, randomInt } from "crypto";
import { FISH, SPECIALS, type FishDef, type Rarity } from "./fish";
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

export type Catch = {
  id: string;
  icon: string;
  name: string;
  weight: number;
  kind: "fish" | "junk" | "frenzy" | "storm" | "treasure";
  rarity: Rarity | null;
};

export type PartyData = {
  /** Device modes: everything earned so far (coins or food units). */
  bank?: number;
  /** Lake Frenzy: the last few catches, frenzy casts left, and a storm hanging over you. */
  catches?: Catch[];
  /** Fishdex: every fish id this player has ever caught, with their heaviest. */
  caught?: Record<string, number>;
  frenzy?: number;
  stormed?: string | null;
  /** Code Breakers. */
  pw?: string;
  hackCharge?: number;
  hackReady?: boolean;
  hack?: { target: string; targetName: string; options: string[]; answer: number } | null;
  /** Gold Rush and Code Breakers: upgrades bought in the shop. */
  shop?: ShopLevels;
  /** Baseball: bases, outs, inning and the pitch on its way. */
  ball?: BallState;
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
  baseball: 1500,
  custom: 900,
  banana: 900,
};

// ---------- Device modes ----------

/** What one right answer (or one tap) earns. */
export function reward(mode: LiveMode, streak: number, tap: boolean): number {
  if (mode === "tower") return tap ? 4 : 10 + Math.min(streak, 10) * 2;
  if (mode === "snack") return tap ? 2 : 4 + Math.floor(Math.min(streak, 9) / 3);
  if (mode === "factory") return tap ? 5 : 15 + Math.min(streak, 10) * 3;
  if (mode === "custom") return tap ? 4 : 10 + Math.min(streak, 10) * 2;
  return 0;
}

/**
 * The most a device-mode score can be. Generous on purpose (the games have
 * upgrades), but it stops a tampered page from posting a huge number.
 */
/** Studio-game Live modes: a score counts up to this many points per coin earned. */
export const CUSTOM_SCORE_PER_COIN = 20;

export function scoreCap(mode: LiveMode, bank: number, elapsedSec: number): number {
  if (mode === "tower") return Math.round(bank * 15 + 300); // waves and kills cost coins to reach
  if (mode === "snack") return Math.round(bank * 40); // the best upgraded price per item
  if (mode === "factory") return Math.round(bank * 0.3 * elapsedSec + bank * 20); // machines turn coins into gadgets per second
  if (mode === "custom") return Math.round(bank * CUSTOM_SCORE_PER_COIN); // Studio games: what's written in the Studio editor
  return 0;
}

// ---------- Lake Frenzy ----------

/**
 * One cast, rolled from the catalog in lib/live/fish.ts. A streak is a
 * better lure (up to +50% weight and slightly better odds on rare fish);
 * a frenzy doubles the next 3 catches; being stormed halves one.
 */
export function cast(streak: number, frenzy: number, stormed: boolean): Catch {
  // A long streak nudges the odds toward the rarer end of the table.
  const luck = 1 + Math.min(streak, 10) * 0.08;
  const table = [
    ...FISH.map((f) => ({ f, w: f.rarity === "Common" || f.rarity === "Uncommon" ? f.weight : f.weight * luck })),
    ...SPECIALS.map((s) => ({ s, w: s.weight })),
  ];
  const total = table.reduce((a, e) => a + e.w, 0);
  let r = Math.random() * total;
  let pick = table[0];
  for (const e of table) {
    if (r < e.w) {
      pick = e;
      break;
    }
    r -= e.w;
  }
  if ("s" in pick && pick.s) {
    const s = pick.s;
    const weight = s.kind === "treasure" ? randomInt(50, 151) : 0;
    return { id: s.id, icon: s.icon, name: s.name, weight, kind: s.kind, rarity: null };
  }
  const f = (pick as { f: FishDef }).f;
  let w = randomInt(f.min, f.max + 1) * (1 + Math.min(streak, 5) * 0.1);
  if (frenzy > 0) w *= 2;
  if (stormed) w /= 2;
  return { id: f.id, icon: f.icon, name: f.name, weight: Math.max(1, Math.round(w)), kind: "fish", rarity: f.rarity };
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

// ---------- Baseball ----------

export type Pitch = { type: "fastball" | "curveball" | "changeup"; ms: number; curve: number };
export type Play = "single" | "double" | "triple" | "homer" | "groundout" | "flyout" | "strikeout";
export type BallState = {
  bases: [boolean, boolean, boolean];
  outs: number;
  inning: number;
  /** Strikes: each wrong answer is one; the third is an out. */
  strikes?: number;
  /** The pitch waiting for a swing (one per right answer). */
  pitch: (Pitch & { issuedAt: number }) | null;
};

export const newBall = (): BallState => ({ bases: [false, false, false], outs: 0, inning: 1, strikes: 0, pitch: null });

/** The next pitch: speed is how long the ball takes from the mound to the plate. */
export function makePitch(): Pitch {
  const r = randomInt(100);
  if (r < 50) return { type: "fastball", ms: randomInt(620, 820), curve: 0 };
  if (r < 80) return { type: "curveball", ms: randomInt(850, 1050), curve: randomInt(-40, 41) };
  return { type: "changeup", ms: randomInt(1050, 1300), curve: randomInt(-10, 11) };
}

/**
 * The HIT button: every swing connects. About 4 in 5 are hits, and an
 * answer streak makes the big ones likelier (up to +10% home runs).
 */
export function easyHit(streak: number): Play {
  const bonus = Math.min(Math.max(0, streak), 5) * 2;
  const r = randomInt(100);
  if (r < 15 + bonus) return "homer";
  if (r < 22 + bonus) return "triple";
  if (r < 42 + bonus) return "double";
  if (r < 80) return "single";
  if (r < 91) return "flyout";
  return "groundout";
}

/** A wrong answer is a strike; the third one is an out. */
export function wrongAnswerStrike(s: BallState): { state: BallState; out: boolean } {
  const strikes = (s.strikes ?? 0) + 1;
  if (strikes >= 3) return { state: { ...s, strikes: 0, pitch: null }, out: true };
  return { state: { ...s, strikes, pitch: null }, out: false };
}

const BASES_FOR: Partial<Record<Play, number>> = { single: 1, double: 2, triple: 3, homer: 4 };

/** Moves the runners for a play. Returns the new state and the runs that scored. */
export function runPlay(s: BallState, play: Play): { state: BallState; runs: number; inningOver: boolean } {
  const hit = BASES_FOR[play];
  if (!hit) {
    const outs = s.outs + 1;
    if (outs >= 3) return { state: { ...s, bases: [false, false, false], outs: 0, inning: s.inning + 1, strikes: 0, pitch: null }, runs: 0, inningOver: true };
    return { state: { ...s, outs, strikes: 0, pitch: null }, runs: 0, inningOver: false };
  }
  let runs = 0;
  const bases: [boolean, boolean, boolean] = [false, false, false];
  // Runners move up as many bases as the hit (everyone scores on a homer).
  s.bases.forEach((on, i) => {
    if (!on) return;
    const to = i + hit;
    if (to >= 3) runs++;
    else bases[to] = true;
  });
  if (hit >= 4) runs++;
  else bases[hit - 1] = true;
  return { state: { ...s, bases, strikes: 0, pitch: null }, runs, inningOver: false };
}

// ---------- Upgrade shop (Gold Rush and Code Breakers) ----------

/**
 * Spend your score to earn faster, like any good economy game: bigger base
 * rewards, a bonus that grows with your streak, a multiplier, and shields
 * that save your streak from one wrong answer. Prices and effects live here
 * on the server, so they can't be changed from a player's device.
 */
export type ShopItem = "earn" | "streak" | "multi" | "shield";
export type ShopLevels = { earn: number; streak: number; multi: number; shields: number; shieldsBought: number };

export const SHOP: Record<ShopItem, { name: string; icon: string; desc: string; prices: number[] }> = {
  earn: { name: "Earnings", icon: "💵", desc: "+25% on every reward", prices: [40, 120, 320, 800, 2000] },
  streak: { name: "Streak Bonus", icon: "🔥", desc: "Extra for every answer in a row", prices: [30, 100, 260, 650, 1600] },
  multi: { name: "Multiplier", icon: "✖️", desc: "×1.5 on everything you earn", prices: [250, 1000, 3500] },
  shield: { name: "Shield", icon: "🛡️", desc: "A wrong answer won't break your streak (one use)", prices: [60] },
};

export const emptyShop = (): ShopLevels => ({ earn: 0, streak: 0, multi: 0, shields: 0, shieldsBought: 0 });

/** What the next level of an item costs, or null when it's maxed. */
export function shopPrice(item: ShopItem, s: ShopLevels): number | null {
  if (item === "shield") return Math.round(SHOP.shield.prices[0] * 1.5 ** Math.min(s.shieldsBought, 8));
  const level = s[item];
  return SHOP[item].prices[level] ?? null;
}

/** Applies the shop to a base reward. */
export function boosted(base: number, streak: number, s: ShopLevels | undefined): number {
  if (!s) return base;
  const withEarn = base * (1 + 0.25 * s.earn);
  const withStreak = withEarn + Math.min(streak, 15) * s.streak * 2;
  return Math.round(withStreak * (1 + 0.5 * s.multi));
}

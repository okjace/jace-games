import { randomInt } from "crypto";

/**
 * Six more Live modes. The first four are skill only (no luck): the
 * outcome depends on right answers, streaks and teamwork. The last two are
 * luck modes. All of it is worked out on the server.
 */

// ---------- Summit Climb (skill) ----------

/** Steps to the summit; first one there wins. */
export const SUMMIT_STEPS = 20;
/** A right answer climbs 1 step, 2 on a streak of 3+. A wrong answer slides back 1. */
export const summitClimb = (streak: number) => (streak >= 3 ? 2 : 1);

// ---------- Last One Standing (skill) ----------

export const SURVIVAL_LIVES = 3;

// ---------- Boss Battle (skill, co-op) ----------

/** The boss's health grows with the room, so it's always a team effort. */
export const bossMaxHp = (players: number) => 200 + Math.max(1, players) * 120;
/** Damage for a right answer: more on a streak. */
export const bossHit = (streak: number) => 10 + Math.min(streak, 10) * 3;
/** A wrong answer heals the boss a little. */
export const BOSS_HEAL = 8;

// ---------- Tug of War (skill, teams) ----------

export type Team = "red" | "blue";
/** How far the rope has to go for a team to win (longer with more players). */
export const tugGoal = (players: number) => 8 + Math.max(2, players) * 2;
/** A right answer pulls 1, 2 on a streak of 3+. */
export const tugPull = (streak: number) => (streak >= 3 ? 2 : 1);

// ---------- Dragon Hatchery (luck) ----------

export type Dragon = { id: string; icon: string; name: string; rarity: "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary" | "Mythic"; power: [number, number]; weight: number };

/** Original dragons. Rarer ones are stronger. */
export const DRAGONS: Dragon[] = [
  { id: "ember", icon: "🦎", name: "Ember Hatchling", rarity: "Common", power: [5, 12], weight: 300 },
  { id: "moss", icon: "🐊", name: "Moss Drake", rarity: "Common", power: [6, 14], weight: 260 },
  { id: "pebble", icon: "🪨", name: "Pebble Wyrm", rarity: "Common", power: [7, 15], weight: 240 },
  { id: "breeze", icon: "🍃", name: "Breeze Glider", rarity: "Uncommon", power: [15, 28], weight: 150 },
  { id: "frost", icon: "❄️", name: "Frostfang", rarity: "Uncommon", power: [16, 30], weight: 130 },
  { id: "bubble", icon: "🫧", name: "Bubble Serpent", rarity: "Uncommon", power: [14, 26], weight: 120 },
  { id: "storm", icon: "⛈️", name: "Stormwing", rarity: "Rare", power: [35, 60], weight: 60 },
  { id: "crystal", icon: "💎", name: "Crystal Scale", rarity: "Rare", power: [40, 65], weight: 50 },
  { id: "shadow", icon: "🌑", name: "Shadow Coil", rarity: "Rare", power: [38, 62], weight: 45 },
  { id: "magma", icon: "🌋", name: "Magma Titan", rarity: "Epic", power: [80, 130], weight: 20 },
  { id: "aurora", icon: "🌌", name: "Aurora Wyvern", rarity: "Epic", power: [85, 140], weight: 16 },
  { id: "sun", icon: "☀️", name: "Sunflare Dragon", rarity: "Legendary", power: [180, 280], weight: 6 },
  { id: "tide", icon: "🌊", name: "Tidal Leviathan", rarity: "Legendary", power: [170, 300], weight: 5 },
  { id: "cosmic", icon: "🪐", name: "Cosmic Elder", rarity: "Mythic", power: [450, 700], weight: 2 },
  { id: "rainbow", icon: "🌈", name: "Prism Dragon", rarity: "Mythic", power: [500, 800], weight: 1 },
];
export const DRAGON_RARITY_COLOR: Record<Dragon["rarity"], string> = {
  Common: "#a3a3a3",
  Uncommon: "#4ade80",
  Rare: "#38bdf8",
  Epic: "#c084fc",
  Legendary: "#facc15",
  Mythic: "#f472b6",
};

/** Hatch an egg: a streak is a warmer nest (a bit more luck with the rare ones). */
export function hatch(streak: number): { dragon: Dragon; power: number } {
  const luck = 1 + Math.min(streak, 10) * 0.08;
  const table = DRAGONS.map((d) => ({ d, w: d.rarity === "Common" || d.rarity === "Uncommon" ? d.weight : d.weight * luck }));
  const total = table.reduce((n, e) => n + e.w, 0);
  let r = Math.random() * total;
  let pick = table[0].d;
  for (const e of table) {
    if (r < e.w) {
      pick = e.d;
      break;
    }
    r -= e.w;
  }
  return { dragon: pick, power: randomInt(pick.power[0], pick.power[1] + 1) };
}

// ---------- Piñata Party (luck) ----------

export type Whack = { kind: "candy" | "explosion" | "golden" | "dud"; candy: number };

/** One whack at the piñata. Taps (no questions) get smaller hauls. */
export function whack(streak: number, tap: boolean): Whack {
  const r = randomInt(100);
  const bonus = 1 + Math.min(streak, 5) * 0.1;
  if (r < 4) return { kind: "golden", candy: Math.round(150 * bonus) };
  if (r < 12) return { kind: "explosion", candy: Math.round(randomInt(40, 81) * bonus) };
  if (r < 20) return { kind: "dud", candy: randomInt(1, 4) };
  return { kind: "candy", candy: Math.round(randomInt(tap ? 4 : 8, tap ? 12 : 21) * bonus) };
}

import { randomInt } from "crypto";

/**
 * Banana Bonanza: every right answer (or tap) peels a random banana event.
 * Most are good, some are rotten, some drag other players in, and sometimes
 * you GO BANANAS (everything you earn is tripled for a few seconds).
 * Rolled on the server, so nobody can pick their own luck.
 */

export type BananaEventId = "bunch" | "bigbunch" | "golden" | "rotten" | "slip" | "monkey" | "rain" | "split" | "mega" | "go";

export const BANANA_EVENTS: Record<BananaEventId, { icon: string; name: string; weight: number }> = {
  bunch: { icon: "🍌", name: "A bunch!", weight: 38 },
  bigbunch: { icon: "🍌🍌🍌", name: "BIG bunch!", weight: 15 },
  golden: { icon: "✨🍌✨", name: "GOLDEN BANANA!", weight: 7 },
  rotten: { icon: "🤢", name: "Rotten bunch…", weight: 8 },
  slip: { icon: "💫", name: "You slipped on a peel!", weight: 6 },
  monkey: { icon: "🐒", name: "Monkey raid!", weight: 9 },
  rain: { icon: "🌧️🍌", name: "BANANA RAIN!", weight: 6 },
  split: { icon: "🍨", name: "Banana split!", weight: 5 },
  mega: { icon: "🦍🍌", name: "MEGA BANANA!", weight: 2 },
  go: { icon: "🤪", name: "GO BANANAS!", weight: 4 },
};

/** How long GO BANANAS lasts, and what it multiplies your gains by. */
export const GO_BANANAS_MS = 15_000;
export const GO_BANANAS_X = 3;

export function rollBanana(): BananaEventId {
  const ids = Object.keys(BANANA_EVENTS) as BananaEventId[];
  const total = ids.reduce((n, id) => n + BANANA_EVENTS[id].weight, 0);
  let r = randomInt(total);
  for (const id of ids) {
    if (r < BANANA_EVENTS[id].weight) return id;
    r -= BANANA_EVENTS[id].weight;
  }
  return "bunch";
}

/** A gain after your streak (+10% each, up to +50%) and GO BANANAS (×3). Losses aren't boosted. */
export function boostBananas(base: number, streak: number, going: boolean): number {
  if (base <= 0) return base;
  return Math.round(base * (1 + Math.min(streak, 5) * 0.1) * (going ? GO_BANANAS_X : 1));
}

/** What an event is worth to you, before boosts. Other players' parts are worked out by the engine. */
export function bananaBase(id: BananaEventId, bananas: number): number {
  switch (id) {
    case "bunch":
      return randomInt(8, 17);
    case "bigbunch":
      return randomInt(20, 36);
    case "golden":
      return randomInt(60, 101);
    case "rotten":
      return -Math.max(5, Math.round(bananas * 0.1));
    case "slip":
      return -Math.min(bananas, randomInt(5, 16));
    case "rain":
      return 25;
    case "split":
      return 30;
    case "mega":
      return Math.min(500, Math.max(50, bananas));
    case "go":
      return 20;
    case "monkey":
      return 0; // the engine works out what the monkey steals
  }
}

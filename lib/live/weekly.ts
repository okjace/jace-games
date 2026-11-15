import type { SeasonId } from "../seasons";
import { itemGrant } from "./locker";
import type { LiveMode } from "./types";

/**
 * The weekly challenge: each week (Monday to Monday, UTC) one featured mode
 * gets its own leaderboard. The top 3 when the week ends can claim a prize
 * you can't get any other way. Seasonal drops live here too.
 */

/** Modes the challenge rotates through (no set needed, so anyone can play them solo). */
export const WEEKLY_MODES: LiveMode[] = ["gold", "rocket", "snake", "sled", "stack", "pinata", "fishing", "banana", "snack", "summit", "hatchery", "sweep", "tower", "factory"];

/** The Monday a week starts on (YYYY-MM-DD, UTC). */
export function weekOf(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export const lastWeek = (date = new Date()) => weekOf(new Date(Date.parse(`${weekOf(date)}T00:00:00Z`) - 86_400_000));
export const weekEnds = (week: string) => Date.parse(`${week}T00:00:00Z`) + 7 * 86_400_000;

export function featuredMode(week: string): LiveMode {
  const n = Math.floor(Date.parse(`${week}T00:00:00Z`) / (7 * 86_400_000));
  return WEEKLY_MODES[((n % WEEKLY_MODES.length) + WEEKLY_MODES.length) % WEEKLY_MODES.length];
}

/** What the top 3 win (as locker grants): 1st gets the gold frame too. */
export function weeklyPrizes(place: number): string[] {
  if (place === 1) return [itemGrant("frame", "wk-gold"), itemGrant("icon", "wk-trophy"), itemGrant("title", "wk-champ")];
  if (place <= 3) return [itemGrant("icon", "wk-medal"), itemGrant("title", "wk-champ")];
  return [];
}

/** Seasonal drops: limited items that can drop at the end of a game while that season is on. */
export const SEASON_DROPS: Partial<Record<SeasonId, string[]>> = {
  halloween: [itemGrant("icon", "s-pumpkin"), itemGrant("frame", "s-spooky"), itemGrant("title", "s-spooky")],
  thanksgiving: [itemGrant("icon", "s-turkey"), itemGrant("frame", "s-harvest")],
  christmas: [itemGrant("icon", "s-snowman"), itemGrant("frame", "s-candycane"), itemGrant("title", "s-merry")],
  winter: [itemGrant("icon", "s-reindeer")],
  newyear: [itemGrant("icon", "s-firework")],
  valentines: [itemGrant("icon", "s-heart")],
  stpatricks: [itemGrant("icon", "s-clover")],
  easter: [itemGrant("icon", "s-bunny")],
  summer: [itemGrant("icon", "s-sun")],
};
/** Chance a finished game drops a seasonal item you don't have yet. */
export const DROP_CHANCE = 0.25;

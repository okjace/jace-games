import type { LiveMode } from "./types";

/**
 * Power-up events: every couple of minutes something hits the whole game for
 * a short while. They work on whatever a player gains (points, or coins in
 * the modes where answers earn coins), so they fit every mode the server
 * scores. Hosts can switch them off.
 */

export type PowerKind = "double" | "triple" | "underdog" | "jackpot" | "lucky";
export type PowerEvent = { id: number; kind: PowerKind; startsAt: number; endsAt: number; /** Jackpot: who won it. */ claimedBy?: string | null };

export const POWERS: Record<PowerKind, { name: string; icon: string; desc: string; seconds: number }> = {
  double: { name: "Double points", icon: "⚡", desc: "evrything u earn counts twice!", seconds: 45 },
  triple: { name: "Triple points", icon: "🔥", desc: "3x evrything, quick!!", seconds: 20 },
  underdog: { name: "Underdog time", icon: "🐢", desc: "the bottom half of the leaderboard gets 3x!", seconds: 45 },
  jackpot: { name: "Jackpot", icon: "🎰", desc: "first one to score next wins a big bonus!", seconds: 40 },
  lucky: { name: "Lucky streak", icon: "🍀", desc: "evry gain has a 1 in 3 chance to be 5x!", seconds: 45 },
};

/** Modes where the host's screen runs the scores (power-ups can't touch those). */
export const NO_POWERUPS: LiveMode[] = ["snake", "mparty", "beacon", "flag"];

/** Time between events (ms): 2–3 minutes, the first one a minute in. */
export const nextGap = (first: boolean) => (first ? 60_000 : 120_000 + Math.random() * 60_000);

export function rollEvent(id: number, now: number, solo = false): PowerEvent {
  // Underdog time needs a leaderboard (not in solo games).
  const kinds: PowerKind[] = ["double", "double", "triple", ...(solo ? [] : (["underdog"] as PowerKind[])), "jackpot", "lucky", "lucky"];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  return { id, kind, startsAt: now, endsAt: now + POWERS[kind].seconds * 1000, claimedBy: null };
}

export const eventOn = (e: PowerEvent | null | undefined, now: number): e is PowerEvent => !!e && now >= e.startsAt && now < e.endsAt;

/**
 * Extra on top of a gain while an event is on. `inBottomHalf` is for
 * Underdog time; Jackpot pays a flat bonus (bigger in points modes).
 */
export function bonusFor(e: PowerEvent, gain: number, inBottomHalf: boolean, coins: boolean): { extra: number; jackpot: boolean } {
  if (gain <= 0) return { extra: 0, jackpot: false };
  switch (e.kind) {
    case "double":
      return { extra: gain, jackpot: false };
    case "triple":
      return { extra: gain * 2, jackpot: false };
    case "underdog":
      return { extra: inBottomHalf ? gain * 2 : 0, jackpot: false };
    case "lucky":
      return { extra: Math.random() < 1 / 3 ? gain * 4 : 0, jackpot: false };
    case "jackpot":
      return e.claimedBy ? { extra: 0, jackpot: false } : { extra: coins ? 60 : 500, jackpot: true };
  }
}

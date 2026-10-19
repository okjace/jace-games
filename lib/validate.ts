import { getGame } from "./games";
import type { ScoreSubmission } from "./types";

const UUIDISH = /^[A-Za-z0-9_-]{8,64}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const EARLIEST = Date.parse("2024-01-01T00:00:00Z");

export type ValidationResult =
  | { ok: true; value: ScoreSubmission }
  | { ok: false; id: string | null; reason: string };

/**
 * Server-side sanity check for a score before it's sent to Jace. The browser
 * can't be trusted alone, so every score must be a whole number in the game's
 * range, from a game that lasted a plausible amount of time, and dated in the
 * past (but not before Jace Games existed).
 */
export function validateSubmission(raw: unknown, now = Date.now()): ValidationResult {
  if (!raw || typeof raw !== "object") return { ok: false, id: null, reason: "Not an object." };
  const r = raw as Record<string, unknown>;
  const id = typeof r.external_id === "string" && UUIDISH.test(r.external_id) ? r.external_id : null;
  if (!id) return { ok: false, id: null, reason: "Missing or invalid external_id." };

  const game = typeof r.game === "string" ? getGame(r.game) : undefined;
  if (!game) return { ok: false, id, reason: "Unknown game." };

  const score = r.score;
  if (typeof score !== "number" || !Number.isInteger(score)) {
    return { ok: false, id, reason: "Score must be a whole number." };
  }
  if (score < game.limits.min || score > game.limits.max) {
    return { ok: false, id, reason: `Score is outside ${game.name}'s range.` };
  }

  const duration = r.duration_ms;
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0 || duration > DAY_MS) {
    return { ok: false, id, reason: "Missing or invalid game length." };
  }
  if (duration < game.limits.minDurationMs(score)) {
    return { ok: false, id, reason: "That game was too short for this score." };
  }

  const createdAt = typeof r.created_at === "string" ? Date.parse(r.created_at) : NaN;
  if (!Number.isFinite(createdAt) || createdAt > now + 5 * 60 * 1000 || createdAt < EARLIEST) {
    return { ok: false, id, reason: "Invalid date." };
  }

  return {
    ok: true,
    value: {
      external_id: id,
      game: game.id,
      score,
      created_at: new Date(createdAt).toISOString(),
      duration_ms: Math.round(duration),
    },
  };
}

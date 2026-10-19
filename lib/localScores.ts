import type { JaceScore, LocalScore, ScoreEntry } from "./types";

/**
 * Scores on this device, in localStorage. Every finished game is written here
 * first, so nothing is lost offline or while Jace's scores API isn't live;
 * the sync engine (components/ScoresProvider.tsx) uploads the pending ones.
 * Jace's copy of the player's scores is cached here too, for offline use.
 */

const SCORES_KEY = "jace-games:scores";
const jaceKey = (userId: string) => `jace-games:jace-scores:${userId}`;
const declinedKey = (userId: string) => `jace-games:upload-declined:${userId}`;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or storage full — the score still shows for this visit.
  }
}

export function loadLocal(): LocalScore[] {
  const list = read<LocalScore[]>(SCORES_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function saveLocal(list: LocalScore[]): void {
  write(SCORES_KEY, list);
}

export function updateLocal(fn: (list: LocalScore[]) => LocalScore[]): LocalScore[] {
  const next = fn(loadLocal());
  saveLocal(next);
  return next;
}

export function loadJaceCache(userId: string): JaceScore[] {
  const list = read<JaceScore[]>(jaceKey(userId), []);
  return Array.isArray(list) ? list : [];
}

export function saveJaceCache(userId: string, scores: JaceScore[]): void {
  write(jaceKey(userId), scores);
}

export function uploadDeclined(userId: string): boolean {
  return read<boolean>(declinedKey(userId), false);
}

export function setUploadDeclined(userId: string): void {
  write(declinedKey(userId), true);
}

export function newScoreId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

const toSecond = (iso: string) => Math.floor(Date.parse(iso) / 1000);

/**
 * The score history for whoever is using the app: Jace's copy plus this
 * device's scores that belong to them, newest first. A local score that is
 * already on Jace is dropped, matched by id (external_id) or by the same
 * game, score and time.
 */
export function mergeHistory(
  userId: string | null,
  local: LocalScore[],
  jace: JaceScore[],
): ScoreEntry[] {
  const out: ScoreEntry[] = [];
  const ids = new Set<string>();
  const fingerprints = new Set<string>();

  if (userId) {
    for (const s of jace) {
      ids.add(s.id);
      fingerprints.add(`${s.game}|${s.score}|${toSecond(s.created_at)}`);
      out.push({ id: s.id, game: s.game, score: s.score, createdAt: s.created_at, localOnly: false });
    }
  }

  for (const s of local) {
    if (s.status === "rejected") continue;
    if (s.owner !== userId) continue;
    if (ids.has(s.id) || fingerprints.has(`${s.game}|${s.score}|${toSecond(s.createdAt)}`)) continue;
    out.push({
      id: s.id,
      game: s.game,
      score: s.score,
      createdAt: s.createdAt,
      localOnly: s.status !== "synced",
    });
  }

  return out.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

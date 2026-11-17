import type { Avatar } from "./locker";
import type { LiveMode } from "./types";

/**
 * Game replays. The host's screen (or a solo player's) records the whole game
 * as it goes: everyone's score every second, big moments, Classic questions
 * with how the room answered, and for Snake Arena the arena itself a few
 * times a second. When the game ends it's saved for 30 days and anyone in
 * the game can watch it back.
 */

export type ReplayPlayer = { id: string; name: string; avatar: Avatar | null; team: number | null };
/** A moment: when (ms after the start) and what happened. */
export type ReplayEvent = { t: number; text: string };
/** Everyone's score at one moment: player id → score. */
export type ScoreFrame = { t: number; s: Record<string, number> };
export type ReplayQuestion = { t: number; prompt: string; choices: string[] | null; counts: number[] | null; right: string; answered: number };
/** Snake Arena: snakes as [id, colour, alive, length, body x,y,x,y…] (thinned), a few times a second. */
export type SnakeFrame = { t: number; s: [string, string, 0 | 1, number, number[]][] };

/**
 * Beacon Rush / Flag Frenzy: the map a few times a second. Players as
 * [id, name, team, x, y, frozen, carrying (0 nothing, 1 beacon, 2 flag)];
 * the beacon as [x, y, planted, carried] or null; flags as [x, y, carried].
 */
export type OpsFrame = {
  t: number;
  ph: "buy" | "play" | "post" | "over";
  r: number;
  at: 0 | 1;
  w: [number, number];
  p: [string, string, 0 | 1, number, number, 0 | 1, 0 | 1 | 2][];
  b: [number, number, 0 | 1, 0 | 1] | null;
  f: [number, number, 0 | 1][];
};

export type ReplayData = {
  v: 1;
  code: string;
  mode: LiveMode;
  setTitle: string | null;
  host: string;
  startedAt: number;
  /** How long it lasted (ms). */
  length: number;
  teams: number | null;
  players: ReplayPlayer[];
  frames: ScoreFrame[];
  events: ReplayEvent[];
  questions: ReplayQuestion[];
  snake: SnakeFrame[];
  ops: OpsFrame[];
};

export const REPLAY_MAX_BYTES = 2_500_000;
export const REPLAY_DAYS = 30;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** A replay sent from a browser, cut down to the known shape and limits. */
export function cleanReplay(raw: unknown, known: { code: string; mode: LiveMode; setTitle: string | null; host: string; players: ReplayPlayer[]; teams: number | null }): ReplayData | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const ids = new Set(known.players.map((p) => p.id));
  const arr = (v: unknown, max: number) => (Array.isArray(v) ? v.slice(0, max) : []);
  const frames: ScoreFrame[] = arr(r.frames, 20_000).map((f) => {
    const o = (f ?? {}) as { t?: unknown; s?: unknown };
    const s: Record<string, number> = {};
    if (o.s && typeof o.s === "object") for (const [k, v] of Object.entries(o.s as Record<string, unknown>)) if (ids.has(k)) s[k] = Math.round(num(v));
    return { t: Math.max(0, Math.round(num(o.t))), s };
  });
  const events: ReplayEvent[] = arr(r.events, 3000).map((e) => ({ t: Math.max(0, Math.round(num((e as ReplayEvent)?.t))), text: str((e as ReplayEvent)?.text, 140) })).filter((e) => e.text);
  const questions: ReplayQuestion[] = arr(r.questions, 300).map((q) => {
    const o = (q ?? {}) as Record<string, unknown>;
    return {
      t: Math.max(0, Math.round(num(o.t))),
      prompt: str(o.prompt, 300),
      choices: Array.isArray(o.choices) ? o.choices.slice(0, 8).map((c) => str(c, 120)) : null,
      counts: Array.isArray(o.counts) ? o.counts.slice(0, 8).map((c) => Math.max(0, Math.round(num(c)))) : null,
      right: str(o.right, 200),
      answered: Math.max(0, Math.round(num(o.answered))),
    };
  });
  const snake: SnakeFrame[] = arr(r.snake, 6000).map((f) => {
    const o = (f ?? {}) as { t?: unknown; s?: unknown };
    return {
      t: Math.max(0, Math.round(num(o.t))),
      s: arr(o.s, 40).map((x) => {
        const a = Array.isArray(x) ? x : [];
        return [str(a[0], 64), /^#[0-9a-f]{6}$/i.test(String(a[1])) ? String(a[1]) : "#888888", a[2] ? 1 : 0, Math.round(num(a[3])), arr(a[4], 120).map((n) => Math.round(num(n)))] as SnakeFrame["s"][number];
      }),
    };
  });
  const bit = (v: unknown) => (v ? 1 : 0) as 0 | 1;
  const ops: OpsFrame[] = arr(r.ops, 6000).map((f) => {
    const o = (f ?? {}) as Record<string, unknown>;
    const b = Array.isArray(o.b) ? o.b : null;
    return {
      t: Math.max(0, Math.round(num(o.t))),
      ph: (["buy", "play", "post", "over"] as const).find((x) => x === o.ph) ?? "play",
      r: Math.max(1, Math.round(num(o.r))),
      at: bit(o.at),
      w: [Math.round(num(arr(o.w, 2)[0])), Math.round(num(arr(o.w, 2)[1]))],
      p: arr(o.p, 40).map((x) => {
        const a = Array.isArray(x) ? x : [];
        return [str(a[0], 64), str(a[1], 40), bit(a[2]), Math.round(num(a[3])), Math.round(num(a[4])), bit(a[5]), Math.min(2, Math.max(0, Math.round(num(a[6])))) as 0 | 1 | 2];
      }),
      b: b ? [Math.round(num(b[0])), Math.round(num(b[1])), bit(b[2]), bit(b[3])] : null,
      f: arr(o.f, 2).map((x) => {
        const a = Array.isArray(x) ? x : [];
        return [Math.round(num(a[0])), Math.round(num(a[1])), bit(a[2])] as [number, number, 0 | 1];
      }),
    };
  });
  const length = Math.max(0, Math.round(num(r.length)));
  return { v: 1, code: known.code, mode: known.mode, setTitle: known.setTitle, host: known.host, startedAt: Math.round(num(r.startedAt)), length, teams: known.teams, players: known.players, frames, events, questions, snake, ops };
}

/** Scores at time t (the last frame at or before it). */
export function scoresAt(frames: ScoreFrame[], t: number): Record<string, number> {
  let lo = 0;
  let hi = frames.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t <= t) {
      best = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return best >= 0 ? frames[best].s : {};
}

import "server-only";
import { createHash } from "crypto";
import type { LivePlayerRow } from "@/lib/db/live";

/**
 * Memory Party: one shared memory board for the whole room (on the big
 * screen and every phone). Each right answer is a turn: flip two cards.
 * Every flip shows for everyone for a few seconds, so watching what others
 * turn over is half the game. A match claims the pair (in your colour),
 * scores, and keeps your turn going; if two people grab the same pair, the
 * first one wins. Clear the board and a fresh one is dealt.
 *
 * Each player's flips and claims live in their own row (data.mp); the board
 * is worked out from everyone's rows, so players never write over each other.
 */

export const MP_PAIRS = 12;
const FACES = ["🦊", "🐼", "🐙", "🦄", "🐸", "🦉", "🐢", "🦋", "🐝", "🦀", "🐳", "🦜", "🐌", "🦔", "🐞", "🦩", "🍕", "🍩", "🌮", "🍉", "🎸", "🚀", "⚽", "🎈"];
/** How long a flip stays face up for everyone. */
export const MP_SHOW_MS = 3500;
const MAX_MOVES = 6;
const MP_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#f97316", "#14b8a6", "#ec4899", "#84cc16", "#06b6d4"];

export type MpData = {
  moves?: number;
  /** The first card of the turn you're on. */
  open?: { cell: number; round: number } | null;
  /** Your recent flips (everyone sees them for a moment). */
  flips?: { cell: number; round: number; at: number }[];
  /** Pairs you claimed: board round, face, and when. */
  pairs?: { round: number; face: number; at: number }[];
  combo?: number;
};

export type MpView = {
  round: number;
  /** Each card: its face (emoji) if it's matched or showing right now, otherwise null. */
  faces: (string | null)[];
  /** Who matched each card (an index into `players`), or -1. */
  owner: number[];
  /** Cards showing right now because someone flipped them. */
  showing: number[];
  players: { name: string; color: string; pairs: number }[];
  moves: number;
  myOpen: number | null;
  combo: number;
};

const mpOf = (p: LivePlayerRow): MpData => ((p.data ?? {}) as { mp?: MpData }).mp ?? {};
const order = (all: LivePlayerRow[]) => [...all].sort((a, b) => a.joined_at.localeCompare(b.joined_at) || a.id.localeCompare(b.id));

/** The cards for a board: the same for everyone (made from the game and round). */
function deal(gameId: string, round: number): number[] {
  const h = createHash("sha256").update(`${gameId}:mp:${round}`).digest();
  let i = 0;
  const rand = () => h[i++ % h.length] / 256 + (i % 7) / 1792;
  // Pick the faces for this board, then shuffle the pairs.
  const faces = FACES.map((_, k) => k)
    .sort((a, b) => h[(a * 3) % 32] - h[(b * 3) % 32] || a - b)
    .slice(0, MP_PAIRS)
    .map((k) => (k + round * 5) % FACES.length);
  const cards = [...faces, ...faces];
  for (let k = cards.length - 1; k > 0; k--) {
    const j = Math.floor(rand() * (k + 1)) % (k + 1);
    [cards[k], cards[j]] = [cards[j], cards[k]];
  }
  return cards;
}

/** The board right now, from everyone's claims and flips. */
function board(gameId: string, all: LivePlayerRow[], now: number) {
  const players = order(all);
  // The first claim of each face in each round wins it.
  const firstClaim = new Map<string, { player: number; at: number }>();
  players.forEach((p, i) => {
    for (const c of mpOf(p).pairs ?? []) {
      const key = `${c.round}:${c.face}`;
      const cur = firstClaim.get(key);
      if (!cur || c.at < cur.at) firstClaim.set(key, { player: i, at: c.at });
    }
  });
  // The board in play is the first one that isn't cleared yet.
  let round = 0;
  for (;;) {
    const cards = deal(gameId, round);
    const faces = new Set(cards);
    if ([...faces].every((f) => firstClaim.has(`${round}:${f}`))) round++;
    else break;
    if (round > 500) break;
  }
  const cards = deal(gameId, round);
  const owner = cards.map((f) => firstClaim.get(`${round}:${f}`)?.player ?? -1);
  const showing = new Set<number>();
  for (const p of players) for (const f of mpOf(p).flips ?? []) if (f.round === round && now - f.at < MP_SHOW_MS) showing.add(f.cell);
  const pairsBy = players.map((_, i) => [...firstClaim.values()].filter((c) => c.player === i).length);
  return { round, cards, owner, showing, players, pairsBy, firstClaim };
}

export function mpView(gameId: string, me: LivePlayerRow | null, all: LivePlayerRow[], now: number): MpView {
  const b = board(gameId, all, now);
  const mine = me ? mpOf(me) : {};
  return {
    round: b.round,
    faces: b.cards.map((f, c) => (b.owner[c] >= 0 || b.showing.has(c) ? FACES[f] : null)),
    owner: b.owner,
    showing: [...b.showing],
    players: b.players.map((p, i) => ({ name: p.name, color: MP_COLORS[i % MP_COLORS.length], pairs: b.pairsBy[i] })),
    moves: mine.moves ?? 0,
    myOpen: mine.open && mine.open.round === b.round ? mine.open.cell : null,
    combo: mine.combo ?? 0,
  };
}

export function mpEarn(me: LivePlayerRow): MpData {
  const d = mpOf(me);
  return { ...d, moves: Math.min(MAX_MOVES, (d.moves ?? 0) + 1) };
}

export class MpError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** Flip a card. Returns the player's new data, their score change and what happened. */
export function mpFlip(gameId: string, me: LivePlayerRow, all: LivePlayerRow[], cell: unknown, now: number): { mp: MpData; points: number; last: Record<string, unknown> } {
  const b = board(gameId, all, now);
  const c = Number(cell);
  if (!Number.isInteger(c) || c < 0 || c >= b.cards.length) throw new MpError("Pick a card.");
  if (b.owner[c] >= 0) throw new MpError("That pair's already taken.");
  let d = mpOf(me);
  const open = d.open && d.open.round === b.round ? d.open : null;
  if (open?.cell === c) throw new MpError("Pick a different card.");
  const flips = [...(d.flips ?? []).filter((f) => now - f.at < MP_SHOW_MS * 2), { cell: c, round: b.round, at: now }].slice(-6);
  if (!open) {
    // The first card of a turn costs a move.
    if ((d.moves ?? 0) < 1) throw new MpError("No turns left. Answer a question to get one!", 409);
    d = { ...d, moves: (d.moves ?? 0) - 1, open: { cell: c, round: b.round }, flips };
    return { mp: d, points: 0, last: { kind: "mp-flip", face: FACES[b.cards[c]] } };
  }
  const a = b.cards[open.cell];
  const bb = b.cards[c];
  if (a !== bb) {
    d = { ...d, open: null, flips, combo: 0 };
    return { mp: d, points: 0, last: { kind: "mp-miss", faces: [FACES[a], FACES[bb]] } };
  }
  if (b.firstClaim.has(`${b.round}:${a}`)) {
    d = { ...d, open: null, flips };
    return { mp: d, points: 0, last: { kind: "mp-late", face: FACES[a] } };
  }
  // A match: claim it, score (more on a combo), and keep the turn going.
  const combo = (d.combo ?? 0) + 1;
  const points = 10 + (combo - 1) * 5;
  d = { ...d, open: null, flips, combo, moves: Math.min(MAX_MOVES, (d.moves ?? 0) + 1), pairs: [...(d.pairs ?? []), { round: b.round, face: a, at: now }].slice(-200) };
  const cleared = b.cards.every((f, k) => b.owner[k] >= 0 || f === a);
  return { mp: d, points: points + (cleared ? 30 : 0), last: { kind: "mp-match", face: FACES[a], points, combo, cleared } };
}

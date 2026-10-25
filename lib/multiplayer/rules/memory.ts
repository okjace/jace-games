import { shuffle } from "../rng";
import type { Rules } from "../types";

const SYMBOLS = ["🐱", "🐶", "🦊", "🐼", "🐸", "🐵", "🦁", "🐯"];

export type MemoryState = {
  cards: string[];
  /** Who matched each card, or -1. */
  owner: number[];
  /** Face-up cards that aren't matched yet (0–2). */
  open: number[];
  /** The last two cards didn't match; they're shown until the next flip. */
  miss: boolean;
  turn: number;
  scores: number[];
  seats: number;
};
export type MemoryMove = { card: number };
/** What players see: symbols only for face-up or matched cards. */
export type MemoryView = Omit<MemoryState, "cards"> & { cards: (string | null)[] };

export const memory: Rules<MemoryState, MemoryMove, MemoryView> = {
  init: (seats, ctx) => ({
    cards: shuffle([...SYMBOLS, ...SYMBOLS], ctx.rng),
    owner: Array(16).fill(-1),
    open: [],
    miss: false,
    turn: 0,
    scores: Array(seats).fill(0),
    seats,
  }),
  apply(state, seat, move) {
    if (state.owner.every((o) => o !== -1)) return { error: "The game is over." };
    if (seat !== state.turn) return { error: "It's not your turn." };
    const card = move?.card;
    if (!Number.isInteger(card) || card < 0 || card >= state.cards.length) return { error: "Pick a card." };
    // A missed pair from the last turn flips back down first.
    let open = state.miss ? [] : [...state.open];
    if (state.owner[card] !== -1 || open.includes(card)) return { error: "That card is already face up." };
    open = [...open, card];
    const next = { ...state, open, miss: false, owner: [...state.owner], scores: [...state.scores] };
    if (open.length < 2) return next;
    const [a, b] = open;
    if (state.cards[a] === state.cards[b]) {
      next.owner[a] = seat;
      next.owner[b] = seat;
      next.scores[seat]++;
      next.open = [];
      return next; // a match: go again
    }
    next.miss = true;
    next.turn = (seat + 1) % state.seats;
    return next;
  },
  view: (s) => ({
    ...s,
    cards: s.cards.map((c, i) => (s.owner[i] !== -1 || s.open.includes(i) ? c : null)),
  }),
  status(s) {
    if (s.owner.some((o) => o === -1)) return { over: false, turn: [s.turn] };
    const top = Math.max(...s.scores);
    return { over: true, winners: s.scores.flatMap((v, i) => (v === top ? [i] : [])) };
  },
};

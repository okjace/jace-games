import type { Rules } from "../types";

/**
 * Dots and Boxes on a 5×5 box grid (6×6 dots) for 2–4 players. Draw one line
 * per turn; completing a box claims it and you go again. Most boxes wins.
 */

export const BOXES = 5;
export type DotsState = {
  /** h[r][c]: the line above box row r (r = 0..5), c = 0..4; v[r][c]: left of box column c (r = 0..4, c = 0..5). -1 = not drawn, else who drew it. */
  h: number[][];
  v: number[][];
  boxes: number[][]; // owner or -1
  turn: number;
  seats: number;
  scores: number[];
  last: { line: "h" | "v"; r: number; c: number } | null;
  /** Seats that left; their turns are skipped. */
  gone: number[];
};
export type DotsMove = { line: "h" | "v"; r: number; c: number };

function nextSeat(s: Pick<DotsState, "seats" | "gone">, from: number): number {
  let t = (from + 1) % s.seats;
  for (let i = 0; i < s.seats && s.gone.includes(t); i++) t = (t + 1) % s.seats;
  return t;
}

const boxDone = (s: Pick<DotsState, "h" | "v">, r: number, c: number) =>
  s.h[r][c] !== -1 && s.h[r + 1][c] !== -1 && s.v[r][c] !== -1 && s.v[r][c + 1] !== -1;

export const dots: Rules<DotsState, DotsMove, DotsState> = {
  init: (seats) => ({
    h: Array.from({ length: BOXES + 1 }, () => Array(BOXES).fill(-1)),
    v: Array.from({ length: BOXES }, () => Array(BOXES + 1).fill(-1)),
    boxes: Array.from({ length: BOXES }, () => Array(BOXES).fill(-1)),
    turn: 0,
    seats,
    scores: Array(seats).fill(0),
    last: null,
    gone: [],
  }),
  apply(state, seat, move) {
    if (state.boxes.every((row) => row.every((b) => b !== -1))) return { error: "The game is over." };
    if (seat !== state.turn) return { error: "It's not your turn." };
    const { line, r, c } = move ?? ({} as DotsMove);
    const grid = line === "h" ? state.h : line === "v" ? state.v : null;
    if (!grid || !Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0 || r >= grid.length || c >= grid[0].length) {
      return { error: "Pick a line." };
    }
    if (grid[r][c] !== -1) return { error: "That line is already drawn." };
    const h = state.h.map((x) => [...x]);
    const v = state.v.map((x) => [...x]);
    (line === "h" ? h : v)[r][c] = seat;
    const boxes = state.boxes.map((x) => [...x]);
    const scores = [...state.scores];
    let claimed = 0;
    const touching = line === "h" ? [[r - 1, c], [r, c]] : [[r, c - 1], [r, c]];
    for (const [br, bc] of touching) {
      if (br < 0 || bc < 0 || br >= BOXES || bc >= BOXES || boxes[br][bc] !== -1) continue;
      if (boxDone({ h, v }, br, bc)) {
        boxes[br][bc] = seat;
        scores[seat]++;
        claimed++;
      }
    }
    return { ...state, h, v, boxes, scores, turn: claimed ? seat : nextSeat(state, seat), last: { line, r, c } };
  },
  view: (s) => s,
  status(s) {
    if (s.boxes.some((row) => row.some((b) => b === -1))) return { over: false, turn: [s.turn] };
    const top = Math.max(...s.scores);
    return { over: true, winners: s.scores.flatMap((v, i) => (v === top ? [i] : [])) };
  },
  // Someone left: their turns are skipped from now on.
  forfeit(state, seat) {
    const gone = [...new Set([...state.gone, seat])];
    return { ...state, gone, turn: state.turn === seat ? nextSeat({ seats: state.seats, gone }, seat) : state.turn };
  },
};

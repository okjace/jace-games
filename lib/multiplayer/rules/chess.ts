import type { Rules } from "../types";

/**
 * Chess with the full rules: castling, en passant, promotion, check,
 * checkmate, stalemate, the 50-move rule, threefold repetition and
 * insufficient material. Seat 0 is white. Squares are 0–63 with 0 = a8 and
 * 63 = h1 (row 0 is black's back rank). Pieces are "wK", "bP", etc.
 */

export type ChessState = {
  board: (string | null)[];
  turn: number; // 0 white, 1 black
  castling: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };
  /** The square a pawn could capture en passant onto, or -1. */
  ep: number;
  halfmove: number;
  /** Position keys since the last capture or pawn move, for threefold repetition. */
  positions: string[];
  result: null | { winner: number | null; reason: "checkmate" | "stalemate" | "fifty" | "repetition" | "material" };
  last: [number, number] | null;
  check: boolean;
  /** SAN-ish history for display, e.g. "e4", "Nxf3", "O-O". */
  moves: string[];
};
export type ChessMove = { from: number; to: number; promo?: "Q" | "R" | "B" | "N" };

const color = (seat: number) => (seat === 0 ? "w" : "b");
const R = (i: number) => i >> 3;
const C = (i: number) => i & 7;
const at = (r: number, c: number) => (r >= 0 && r < 8 && c >= 0 && c < 8 ? r * 8 + c : -1);
export const squareName = (i: number) => "abcdefgh"[C(i)] + (8 - R(i));

const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const ROOK = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISHOP = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

/** Is square `sq` attacked by side `by` ("w" | "b")? */
function attacked(board: (string | null)[], sq: number, by: string): boolean {
  const r = R(sq);
  const c = C(sq);
  const pawnDir = by === "w" ? 1 : -1; // white pawns attack from below (higher rows)
  for (const dc of [-1, 1]) {
    const s = at(r + pawnDir, c + dc);
    if (s >= 0 && board[s] === `${by}P`) return true;
  }
  for (const [dr, dc] of KNIGHT) {
    const s = at(r + dr, c + dc);
    if (s >= 0 && board[s] === `${by}N`) return true;
  }
  for (const [dr, dc] of KING) {
    const s = at(r + dr, c + dc);
    if (s >= 0 && board[s] === `${by}K`) return true;
  }
  for (const [dirs, kinds] of [[ROOK, "RQ"], [BISHOP, "BQ"]] as const) {
    for (const [dr, dc] of dirs) {
      let rr = r + dr;
      let cc = c + dc;
      while (at(rr, cc) >= 0) {
        const p = board[at(rr, cc)];
        if (p) {
          if (p[0] === by && kinds.includes(p[1])) return true;
          break;
        }
        rr += dr;
        cc += dc;
      }
    }
  }
  return false;
}

function inCheck(board: (string | null)[], side: string): boolean {
  const k = board.indexOf(`${side}K`);
  return k >= 0 && attacked(board, k, side === "w" ? "b" : "w");
}

type Pseudo = { from: number; to: number; promo?: string; ep?: boolean; castle?: "K" | "Q"; double?: boolean };

function pseudoMoves(s: ChessState, side: string): Pseudo[] {
  const out: Pseudo[] = [];
  const enemy = side === "w" ? "b" : "w";
  s.board.forEach((p, from) => {
    if (!p || p[0] !== side) return;
    const r = R(from);
    const c = C(from);
    const kind = p[1];
    if (kind === "P") {
      const dir = side === "w" ? -1 : 1;
      const startRow = side === "w" ? 6 : 1;
      const lastRow = side === "w" ? 0 : 7;
      const one = at(r + dir, c);
      const push = (to: number, extra: Partial<Pseudo> = {}) => {
        if (R(to) === lastRow) for (const promo of ["Q", "R", "B", "N"]) out.push({ from, to, promo, ...extra });
        else out.push({ from, to, ...extra });
      };
      if (one >= 0 && !s.board[one]) {
        push(one);
        const two = at(r + 2 * dir, c);
        if (r === startRow && !s.board[two]) out.push({ from, to: two, double: true });
      }
      for (const dc of [-1, 1]) {
        const t = at(r + dir, c + dc);
        if (t < 0) continue;
        if (s.board[t]?.[0] === enemy) push(t);
        else if (t === s.ep) out.push({ from, to: t, ep: true });
      }
    } else if (kind === "N" || kind === "K") {
      for (const [dr, dc] of kind === "N" ? KNIGHT : KING) {
        const t = at(r + dr, c + dc);
        if (t >= 0 && s.board[t]?.[0] !== side) out.push({ from, to: t });
      }
      if (kind === "K") {
        const home = side === "w" ? 60 : 4;
        if (from === home && !attacked(s.board, home, enemy)) {
          const rights = s.castling;
          if ((side === "w" ? rights.wK : rights.bK) && s.board[home + 3] === `${side}R` && !s.board[home + 1] && !s.board[home + 2] && !attacked(s.board, home + 1, enemy)) {
            out.push({ from, to: home + 2, castle: "K" });
          }
          if ((side === "w" ? rights.wQ : rights.bQ) && s.board[home - 4] === `${side}R` && !s.board[home - 1] && !s.board[home - 2] && !s.board[home - 3] && !attacked(s.board, home - 1, enemy)) {
            out.push({ from, to: home - 2, castle: "Q" });
          }
        }
      }
    } else {
      const dirs = kind === "R" ? ROOK : kind === "B" ? BISHOP : [...ROOK, ...BISHOP];
      for (const [dr, dc] of dirs) {
        let rr = r + dr;
        let cc = c + dc;
        while (at(rr, cc) >= 0) {
          const t = at(rr, cc);
          if (s.board[t]?.[0] === side) break;
          out.push({ from, to: t });
          if (s.board[t]) break;
          rr += dr;
          cc += dc;
        }
      }
    }
  });
  return out;
}

function play(board: (string | null)[], m: Pseudo, side: string): (string | null)[] {
  const b = [...board];
  const piece = b[m.from]!;
  b[m.from] = null;
  if (m.ep) b[m.to + (side === "w" ? 8 : -8)] = null;
  if (m.castle === "K") {
    b[m.from + 1] = b[m.from + 3];
    b[m.from + 3] = null;
  }
  if (m.castle === "Q") {
    b[m.from - 1] = b[m.from - 4];
    b[m.from - 4] = null;
  }
  b[m.to] = m.promo ? `${side}${m.promo}` : piece;
  return b;
}

export function legalMoves(s: ChessState, seat: number): Pseudo[] {
  const side = color(seat);
  return pseudoMoves(s, side).filter((m) => !inCheck(play(s.board, m, side), side));
}

function positionKey(s: Pick<ChessState, "board" | "turn" | "castling" | "ep">): string {
  const c = s.castling;
  return `${s.board.map((p) => p ?? "--").join("")}|${s.turn}|${+c.wK}${+c.wQ}${+c.bK}${+c.bQ}|${s.ep}`;
}

function insufficient(board: (string | null)[]): boolean {
  const pieces = board.filter(Boolean) as string[];
  if (pieces.some((p) => "PQR".includes(p[1]))) return false;
  const minors = pieces.filter((p) => p[1] === "B" || p[1] === "N");
  return minors.length <= 1;
}

function san(s: ChessState, m: Pseudo, after: (string | null)[], side: string): string {
  if (m.castle) return m.castle === "K" ? "O-O" : "O-O-O";
  const piece = s.board[m.from]![1];
  const capture = !!s.board[m.to] || m.ep;
  let out = piece === "P" ? (capture ? "abcdefgh"[C(m.from)] : "") : piece;
  if (piece !== "P") {
    // Disambiguate when two of the same piece could move there.
    const twins = legalMoves(s, side === "w" ? 0 : 1).filter((o) => o.to === m.to && o.from !== m.from && s.board[o.from] === s.board[m.from]);
    if (twins.length) out += twins.some((o) => C(o.from) === C(m.from)) ? 8 - R(m.from) : "abcdefgh"[C(m.from)];
  }
  out += (capture ? "x" : "") + squareName(m.to) + (m.promo ? `=${m.promo}` : "");
  const enemy = side === "w" ? "b" : "w";
  if (inCheck(after, enemy)) out += "+";
  return out;
}

const START = [
  "bR", "bN", "bB", "bQ", "bK", "bB", "bN", "bR",
  "bP", "bP", "bP", "bP", "bP", "bP", "bP", "bP",
  null, null, null, null, null, null, null, null,
  null, null, null, null, null, null, null, null,
  null, null, null, null, null, null, null, null,
  null, null, null, null, null, null, null, null,
  "wP", "wP", "wP", "wP", "wP", "wP", "wP", "wP",
  "wR", "wN", "wB", "wQ", "wK", "wB", "wN", "wR",
];

export function initialChess(board: (string | null)[] = START, turn = 0): ChessState {
  const s: ChessState = {
    board: [...board],
    turn,
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    ep: -1,
    halfmove: 0,
    positions: [],
    result: null,
    last: null,
    check: false,
    moves: [],
  };
  s.positions = [positionKey(s)];
  s.check = inCheck(s.board, color(turn));
  return s;
}

export const chess: Rules<ChessState, ChessMove, ChessState> = {
  init: () => initialChess(),
  apply(s, seat, move) {
    if (s.result) return { error: "The game is over." };
    if (seat !== s.turn) return { error: "It's not your turn." };
    const side = color(seat);
    const promo = move?.promo ?? "Q";
    const m = legalMoves(s, seat).find((x) => x.from === move?.from && x.to === move?.to && (!x.promo || x.promo === promo));
    if (!m) return { error: "That move isn't legal." };
    const board = play(s.board, m, side);
    const piece = s.board[m.from]!;
    const castling = { ...s.castling };
    if (piece === "wK") castling.wK = castling.wQ = false;
    if (piece === "bK") castling.bK = castling.bQ = false;
    for (const sq of [m.from, m.to]) {
      if (sq === 63) castling.wK = false;
      if (sq === 56) castling.wQ = false;
      if (sq === 7) castling.bK = false;
      if (sq === 0) castling.bQ = false;
    }
    const reset = piece[1] === "P" || !!s.board[m.to] || !!m.ep;
    const next: ChessState = {
      ...s,
      board,
      turn: 1 - seat,
      castling,
      ep: m.double ? (m.from + m.to) / 2 : -1,
      halfmove: reset ? 0 : s.halfmove + 1,
      last: [m.from, m.to],
      moves: [...s.moves, san(s, m, board, side)],
      check: false,
      positions: [],
    };
    const key = positionKey(next);
    next.positions = reset ? [key] : [...s.positions, key];
    const enemy = color(1 - seat);
    next.check = inCheck(board, enemy);
    const replies = legalMoves(next, 1 - seat).length;
    if (replies === 0) {
      next.result = next.check ? { winner: seat, reason: "checkmate" } : { winner: null, reason: "stalemate" };
      if (next.check) next.moves[next.moves.length - 1] = next.moves[next.moves.length - 1].replace(/\+$/, "#");
    } else if (next.halfmove >= 100) next.result = { winner: null, reason: "fifty" };
    else if (next.positions.filter((p) => p === key).length >= 3) next.result = { winner: null, reason: "repetition" };
    else if (insufficient(board)) next.result = { winner: null, reason: "material" };
    return next;
  },
  view: (s) => s,
  status: (s) =>
    s.result ? { over: true, winners: s.result.winner === null ? [] : [s.result.winner] } : { over: false, turn: [s.turn] },
};

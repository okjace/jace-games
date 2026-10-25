import type { Rules } from "../types";

/**
 * American checkers on an 8×8 board. Seat 0 starts at the bottom and moves
 * up; seat 1 starts at the top and moves down. Captures are mandatory, a
 * capturing piece must keep jumping while it can, and reaching the far row
 * makes a king (which ends the turn). A player with no pieces or no legal
 * move loses; 80 moves in a row without a capture or a new king is a draw.
 */

export type Piece = { seat: number; king: boolean } | null;
export type CheckersState = {
  board: Piece[];
  turn: number;
  /** A piece in the middle of a multi-jump, which must keep jumping. */
  chain: number | null;
  quiet: number;
  winner: number | null;
  draw: boolean;
  last: [number, number] | null;
};
export type CheckersMove = { from: number; to: number };

const N = 8;
const rc = (i: number) => [Math.floor(i / N), i % N] as const;
const idx = (r: number, c: number) => (r >= 0 && r < N && c >= 0 && c < N ? r * N + c : -1);

function dirs(p: NonNullable<Piece>): [number, number][] {
  if (p.king) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  return p.seat === 0 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
}

/** Legal moves for one piece: captures (jumps) and plain steps. */
function pieceMoves(board: Piece[], from: number) {
  const p = board[from];
  const jumps: { to: number; over: number }[] = [];
  const steps: number[] = [];
  if (!p) return { jumps, steps };
  const [r, c] = rc(from);
  for (const [dr, dc] of dirs(p)) {
    const one = idx(r + dr, c + dc);
    if (one < 0) continue;
    if (!board[one]) steps.push(one);
    else if (board[one]!.seat !== p.seat) {
      const two = idx(r + 2 * dr, c + 2 * dc);
      if (two >= 0 && !board[two]) jumps.push({ to: two, over: one });
    }
  }
  return { jumps, steps };
}

/** Every legal move for a seat (only jumps if any jump exists). */
export function legalMoves(state: CheckersState, seat: number): CheckersMove[] {
  if (state.chain !== null) {
    return pieceMoves(state.board, state.chain).jumps.map((j) => ({ from: state.chain!, to: j.to }));
  }
  const jumps: CheckersMove[] = [];
  const steps: CheckersMove[] = [];
  state.board.forEach((p, from) => {
    if (p?.seat !== seat) return;
    const m = pieceMoves(state.board, from);
    m.jumps.forEach((j) => jumps.push({ from, to: j.to }));
    m.steps.forEach((to) => steps.push({ from, to }));
  });
  return jumps.length ? jumps : steps;
}

export const checkers: Rules<CheckersState, CheckersMove, CheckersState> = {
  init: () => {
    const board: Piece[] = Array(64).fill(null);
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++) {
        if ((r + c) % 2 === 0) continue;
        if (r < 3) board[idx(r, c)] = { seat: 1, king: false };
        if (r > 4) board[idx(r, c)] = { seat: 0, king: false };
      }
    return { board, turn: 0, chain: null, quiet: 0, winner: null, draw: false, last: null };
  },
  apply(state, seat, move) {
    if (state.winner !== null || state.draw) return { error: "The game is over." };
    if (seat !== state.turn) return { error: "It's not your turn." };
    const legal = legalMoves(state, seat);
    if (!legal.some((m) => m.from === move?.from && m.to === move?.to)) {
      return { error: legal.some((m) => Math.abs(rc(m.from)[0] - rc(m.to)[0]) === 2) ? "You have to capture." : "You can't move there." };
    }
    const board = [...state.board];
    const piece = { ...board[move.from]! };
    board[move.from] = null;
    const jumped = Math.abs(rc(move.from)[0] - rc(move.to)[0]) === 2;
    if (jumped) board[(move.from + move.to) / 2] = null;
    const [toRow] = rc(move.to);
    const crowned = !piece.king && ((piece.seat === 0 && toRow === 0) || (piece.seat === 1 && toRow === N - 1));
    if (crowned) piece.king = true;
    board[move.to] = piece;

    let next: CheckersState = {
      ...state,
      board,
      chain: null,
      quiet: jumped || crowned ? 0 : state.quiet + 1,
      last: [move.from, move.to],
    };
    // Keep jumping with the same piece if possible (unless it was just crowned).
    if (jumped && !crowned && pieceMoves(board, move.to).jumps.length) return { ...next, chain: move.to };

    const other = 1 - seat;
    next = { ...next, turn: other };
    const opponentHasPieces = board.some((p) => p?.seat === other);
    if (!opponentHasPieces || legalMoves(next, other).length === 0) return { ...next, winner: seat, turn: seat };
    if (next.quiet >= 80) return { ...next, draw: true };
    return next;
  },
  view: (s) => s,
  status: (s) =>
    s.winner !== null ? { over: true, winners: [s.winner] } : s.draw ? { over: true, winners: [] } : { over: false, turn: [s.turn] },
};

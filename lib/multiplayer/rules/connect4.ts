import type { Rules } from "../types";

export const COLS = 7;
export const ROWS = 6;

export type C4State = {
  /** board[row][col], row 0 at the top; -1 empty, else the seat. */
  board: number[][];
  turn: number;
  winner: number | null;
  draw: boolean;
  /** The four winning cells, for highlighting. */
  line: [number, number][] | null;
  last: [number, number] | null;
};
export type C4Move = { col: number };

function findLine(board: number[][], r: number, c: number): [number, number][] | null {
  const who = board[r][c];
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const cells: [number, number][] = [[r, c]];
    for (const sign of [1, -1]) {
      let rr = r + dr * sign;
      let cc = c + dc * sign;
      while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && board[rr][cc] === who) {
        cells.push([rr, cc]);
        rr += dr * sign;
        cc += dc * sign;
      }
    }
    if (cells.length >= 4) return cells;
  }
  return null;
}

export const connect4: Rules<C4State, C4Move, C4State> = {
  init: () => ({
    board: Array.from({ length: ROWS }, () => Array(COLS).fill(-1)),
    turn: 0,
    winner: null,
    draw: false,
    line: null,
    last: null,
  }),
  apply(state, seat, move) {
    if (state.winner !== null || state.draw) return { error: "The game is over." };
    if (seat !== state.turn) return { error: "It's not your turn." };
    const col = move?.col;
    if (!Number.isInteger(col) || col < 0 || col >= COLS) return { error: "Pick a column." };
    let row = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (state.board[r][col] === -1) {
        row = r;
        break;
      }
    }
    if (row === -1) return { error: "That column is full." };
    const board = state.board.map((r) => [...r]);
    board[row][col] = seat;
    const line = findLine(board, row, col);
    const draw = !line && board[0].every((v) => v !== -1);
    return { board, turn: line || draw ? state.turn : 1 - seat, winner: line ? seat : null, draw, line, last: [row, col] };
  },
  view: (s) => s,
  status: (s) =>
    s.winner !== null ? { over: true, winners: [s.winner] } : s.draw ? { over: true, winners: [] } : { over: false, turn: [s.turn] },
};

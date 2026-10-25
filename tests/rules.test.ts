// Tests for the turn-based rules modules (npm test). Plain asserts, no framework.
import assert from "node:assert/strict";
import { seededRandom } from "../lib/multiplayer/rng";
import { RULES } from "../lib/multiplayer/registry";
import { battleship, randomFleet, shipCells, validFleet, type BattleshipView } from "../lib/multiplayer/rules/battleship";
import { checkers, legalMoves as checkersMoves, type CheckersState } from "../lib/multiplayer/rules/checkers";
import { chess, initialChess, legalMoves as chessMoves, type ChessState } from "../lib/multiplayer/rules/chess";
import { connect4, type C4State } from "../lib/multiplayer/rules/connect4";
import { dots, type DotsState } from "../lib/multiplayer/rules/dots";
import { draw, type DrawState, type DrawView } from "../lib/multiplayer/rules/draw";
import { memory, type MemoryState } from "../lib/multiplayer/rules/memory";
import { isError, type Ctx } from "../lib/multiplayer/types";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error(`✗ ${name}`);
    throw e;
  }
};
const ctx = (now = 0, seed = 1): Ctx => ({ now, rng: seededRandom(seed) });
function ok<S>(r: S | { error: string }): S {
  if (isError(r)) throw new Error(`unexpected error: ${r.error}`);
  return r;
}
function err(r: unknown, match?: RegExp) {
  assert.ok(isError(r), "expected an error");
  if (match) assert.match((r as { error: string }).error, match);
}
const sq = (name: string) => (8 - Number(name[1])) * 8 + "abcdefgh".indexOf(name[0]);

test("connect four: turns, full column, vertical win", () => {
  let s = connect4.init(2, ctx());
  err(connect4.apply(s, 1, { col: 0 }, ctx()), /turn/);
  for (let i = 0; i < 3; i++) {
    s = ok(connect4.apply(s, 0, { col: 0 }, ctx()));
    s = ok(connect4.apply(s, 1, { col: 1 }, ctx()));
  }
  s = ok(connect4.apply(s, 0, { col: 0 }, ctx())) as C4State;
  assert.equal(s.winner, 0);
  assert.deepEqual(connect4.status(s), { over: true, winners: [0] });
  err(connect4.apply(s, 1, { col: 2 }, ctx()), /over/);
  let f = connect4.init(2, ctx());
  for (let i = 0; i < 6; i++) f = ok(connect4.apply(f, i % 2, { col: 3 }, ctx()));
  err(connect4.apply(f, 0, { col: 3 }, ctx()), /full/);
  err(connect4.apply(f, 0, { col: 9 }, ctx()));
});

test("connect four: diagonal win", () => {
  let s = connect4.init(2, ctx());
  // Builds a rising diagonal for seat 0 at columns 0..3.
  for (const [seat, col] of [[0, 0], [1, 1], [0, 1], [1, 2], [0, 2], [1, 3], [0, 2], [1, 3], [0, 3], [1, 6], [0, 3]] as const) {
    s = ok(connect4.apply(s, seat, { col }, ctx()));
  }
  assert.equal(s.winner, 0);
});

test("memory: hides faces, match keeps the turn, miss passes it", () => {
  let s = memory.init(2, ctx(0, 7)) as MemoryState;
  const v = memory.view(s, 0);
  assert.ok(v.cards.every((c) => c === null), "no face visible at start");
  const a = 0;
  const b = s.cards.indexOf(s.cards[0], 1);
  const wrong = s.cards.findIndex((c, i) => i !== 0 && c !== s.cards[0]);
  s = ok(memory.apply(s, 0, { card: a }, ctx()));
  assert.equal(memory.view(s, 1).cards[a], s.cards[a]);
  s = ok(memory.apply(s, 0, { card: wrong }, ctx()));
  assert.equal(s.turn, 1);
  assert.ok(s.miss);
  err(memory.apply(s, 0, { card: 3 }, ctx()), /turn/);
  s = ok(memory.apply(s, 1, { card: a }, ctx()));
  s = ok(memory.apply(s, 1, { card: b }, ctx()));
  assert.equal(s.scores[1], 1);
  assert.equal(s.turn, 1, "a match goes again");
  err(memory.apply(s, 1, { card: a }, ctx()), /face up/);
});

test("checkers: forced capture, multi-jump, crowning", () => {
  const empty = () => Array(64).fill(null);
  const base = checkers.init(2, ctx()) as CheckersState;
  const board = empty();
  board[5 * 8 + 2] = { seat: 0, king: false }; // c3
  board[4 * 8 + 3] = { seat: 1, king: false }; // d4
  board[2 * 8 + 5] = { seat: 1, king: false }; // f6
  board[0] = { seat: 1, king: false };
  let s: CheckersState = { ...base, board };
  const moves = checkersMoves(s, 0);
  assert.deepEqual(moves, [{ from: 42, to: 28 }], "must capture");
  err(checkers.apply(s, 0, { from: 42, to: 33 }, ctx()), /capture/);
  s = ok(checkers.apply(s, 0, { from: 42, to: 28 }, ctx()));
  assert.equal(s.chain, 28, "keeps jumping");
  assert.equal(s.turn, 0);
  s = ok(checkers.apply(s, 0, { from: 28, to: 14 }, ctx()));
  assert.equal(s.board[35], null);
  assert.equal(s.chain, null);
  assert.equal(s.turn, 1);
  // Crown: a seat-0 man reaching row 0.
  const b2 = empty();
  b2[8 + 2] = { seat: 0, king: false };
  b2[63] = { seat: 1, king: false };
  let k: CheckersState = { ...base, board: b2 };
  k = ok(checkers.apply(k, 0, { from: 10, to: 1 }, ctx()));
  assert.equal(k.board[1]?.king, true);
});

test("checkers: no pieces left loses", () => {
  const base = checkers.init(2, ctx()) as CheckersState;
  const board = Array(64).fill(null);
  board[42] = { seat: 0, king: false };
  board[35] = { seat: 1, king: false };
  const s = ok(checkers.apply({ ...base, board }, 0, { from: 42, to: 28 }, ctx()));
  assert.equal(s.winner, 0);
});

function playSan(moves: [string, string, ("Q" | "R" | "B" | "N")?][], start?: ChessState) {
  let s = start ?? initialChess();
  for (const [from, to, promo] of moves) s = ok(chess.apply(s, s.turn, { from: sq(from), to: sq(to), promo }, ctx()));
  return s;
}

test("chess: 20 opening moves, illegal moves rejected", () => {
  const s = initialChess();
  assert.equal(chessMoves(s, 0).length, 20);
  err(chess.apply(s, 0, { from: sq("e2"), to: sq("e5") }, ctx()), /legal/);
  err(chess.apply(s, 1, { from: sq("e7"), to: sq("e5") }, ctx()), /turn/);
  err(chess.apply(s, 0, { from: sq("a1"), to: sq("a3") }, ctx()), /legal/);
});

test("chess: fool's mate is checkmate", () => {
  const s = playSan([["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]);
  assert.deepEqual(s.result, { winner: 1, reason: "checkmate" });
  assert.equal(s.moves.at(-1), "Qh4#");
});

test("chess: castling, en passant, promotion", () => {
  let s = playSan([["e2", "e4"], ["a7", "a6"], ["g1", "f3"], ["a6", "a5"], ["f1", "c4"], ["a5", "a4"]]);
  s = ok(chess.apply(s, 0, { from: sq("e1"), to: sq("g1") }, ctx()));
  assert.equal(s.board[sq("f1")], "wR");
  assert.equal(s.board[sq("g1")], "wK");
  assert.equal(s.moves.at(-1), "O-O");
  // En passant.
  let e = playSan([["e2", "e4"], ["a7", "a6"], ["e4", "e5"], ["d7", "d5"]]);
  e = ok(chess.apply(e, 0, { from: sq("e5"), to: sq("d6") }, ctx()));
  assert.equal(e.board[sq("d5")], null, "captured pawn removed");
  assert.equal(e.moves.at(-1), "exd6");
  // Promotion to a knight.
  const board: (string | null)[] = Array(64).fill(null);
  board[sq("e1")] = "wK";
  board[sq("h8")] = "bK";
  board[sq("b7")] = "wP";
  let p = initialChess(board, 0);
  p = { ...p, castling: { wK: false, wQ: false, bK: false, bQ: false } };
  p = ok(chess.apply(p, 0, { from: sq("b7"), to: sq("b8"), promo: "N" }, ctx()));
  assert.equal(p.board[sq("b8")], "wN");
});

test("chess: can't castle through check; pinned piece can't move", () => {
  const board: (string | null)[] = Array(64).fill(null);
  board[sq("e1")] = "wK";
  board[sq("h1")] = "wR";
  board[sq("f8")] = "bR";
  board[sq("a8")] = "bK";
  const s = initialChess(board, 0);
  assert.ok(!chessMoves(s, 0).some((m) => m.castle), "f1 is attacked");
  const b2: (string | null)[] = Array(64).fill(null);
  b2[sq("e1")] = "wK";
  b2[sq("e2")] = "wN";
  b2[sq("e8")] = "bR";
  b2[sq("a8")] = "bK";
  const pinned = initialChess(b2, 0);
  assert.ok(!chessMoves(pinned, 0).some((m) => m.from === sq("e2")), "knight is pinned");
});

test("chess: stalemate and insufficient material", () => {
  const board: (string | null)[] = Array(64).fill(null);
  board[sq("a8")] = "bK";
  board[sq("b6")] = "wK";
  board[sq("c6")] = "wQ";
  let s = initialChess(board, 0);
  s = { ...s, castling: { wK: false, wQ: false, bK: false, bQ: false } };
  s = ok(chess.apply(s, 0, { from: sq("c6"), to: sq("c7") }, ctx()));
  assert.deepEqual(s.result, { winner: null, reason: "stalemate" });
  const b2: (string | null)[] = Array(64).fill(null);
  b2[sq("a8")] = "bK";
  b2[sq("h1")] = "wK";
  b2[sq("b7")] = "wN";
  b2[sq("a7")] = "bP";
  let m = initialChess(b2, 1);
  m = { ...m, castling: { wK: false, wQ: false, bK: false, bQ: false } };
  m = ok(chess.apply(m, 1, { from: sq("a8"), to: sq("b7") }, ctx()));
  assert.equal(m.result, null, "a pawn is still on the board");
});

test("chess: threefold repetition", () => {
  const knights: [string, string][] = [["g1", "f3"], ["g8", "f6"], ["f3", "g1"], ["f6", "g8"]];
  const s = playSan([...knights, ...knights]);
  assert.deepEqual(s.result, { winner: null, reason: "repetition" });
});

test("battleship: placement, hidden ships, firing, sinking, win", () => {
  let s = battleship.init(2, ctx());
  const fleet0 = randomFleet(seededRandom(3));
  const fleet1 = randomFleet(seededRandom(4));
  assert.ok(validFleet(fleet0) && validFleet(fleet1));
  err(battleship.apply(s, 0, { place: [{ x: 8, y: 0, len: 5, dir: "h" }, ...fleet0.slice(1)] }, ctx()), /fit/);
  s = ok(battleship.apply(s, 0, { place: fleet0 }, ctx()));
  err(battleship.apply(s, 0, { fire: 0 }, ctx()), /both/);
  s = ok(battleship.apply(s, 1, { place: fleet1 }, ctx()));
  const v1 = battleship.view(s, 1) as BattleshipView;
  assert.equal(v1.theirShips.length, 0, "can't see the other fleet");
  assert.equal(JSON.stringify(v1).includes(JSON.stringify(fleet0[0])), false, "no leak of seat 0's ships");
  const targets = fleet1.flatMap(shipCells);
  const misses = Array.from({ length: 100 }, (_, i) => i).filter((i) => !fleet0.flatMap(shipCells).includes(i));
  let mi = 0;
  for (const cell of targets) {
    s = ok(battleship.apply(s, 0, { fire: cell }, ctx()));
    if (s.winner !== null) break;
    s = ok(battleship.apply(s, 1, { fire: misses[mi++] }, ctx()));
  }
  assert.equal(s.winner, 0);
  assert.equal((battleship.view(s, 1) as BattleshipView).theirShips.length, 5, "revealed at the end");
});

test("dots: claiming a box goes again; most boxes wins", () => {
  let s = dots.init(2, ctx()) as DotsState;
  s = ok(dots.apply(s, 0, { line: "h", r: 0, c: 0 }, ctx()));
  s = ok(dots.apply(s, 1, { line: "v", r: 0, c: 0 }, ctx()));
  s = ok(dots.apply(s, 0, { line: "v", r: 0, c: 1 }, ctx()));
  err(dots.apply(s, 0, { line: "h", r: 0, c: 0 }, ctx()));
  s = ok(dots.apply(s, 1, { line: "h", r: 1, c: 0 }, ctx()));
  assert.equal(s.boxes[0][0], 1);
  assert.equal(s.turn, 1, "completing a box goes again");
  // Fill the rest; the game must end.
  let guard = 0;
  while (!dots.status(s).over && guard++ < 200) {
    const t = (dots.status(s) as { turn: number[] }).turn[0];
    const h = s.h.flatMap((row, r) => row.flatMap((v, c) => (v === -1 ? [{ line: "h" as const, r, c }] : [])));
    const v = s.v.flatMap((row, r) => row.flatMap((x, c) => (x === -1 ? [{ line: "v" as const, r, c }] : [])));
    s = ok(dots.apply(s, t, [...h, ...v][0], ctx()));
  }
  assert.ok(dots.status(s).over);
  assert.equal(s.scores.reduce((a, b) => a + b, 0), 25);
});

test("dots: someone leaving is skipped", () => {
  let s = dots.init(3, ctx()) as DotsState;
  s = dots.forfeit!(s, 1, ctx());
  s = ok(dots.apply(s, 0, { line: "h", r: 0, c: 0 }, ctx()));
  assert.equal(s.turn, 2);
});

test("draw & guess: word hidden, guessing scores, timing", () => {
  let s = draw.init(3, ctx(1000, 9)) as DrawState;
  assert.equal(s.phase, "choose");
  const drawer = s.order[s.idx];
  const guesser = (drawer + 1) % 3;
  assert.equal((draw.view(s, guesser) as DrawView).choices.length, 0, "only the drawer sees choices");
  assert.equal((draw.view(s, drawer) as DrawView).choices.length, 3);
  err(draw.apply(s, guesser, { choose: 0 }, ctx(1100)));
  err(draw.apply(s, drawer, { tick: true }, ctx(2000)), /yet/);
  s = ok(draw.apply(s, drawer, { choose: 1 }, ctx(2000)));
  const word = s.word!;
  const gv = draw.view(s, guesser) as DrawView;
  assert.equal(gv.word, null);
  assert.ok(!JSON.stringify(gv).includes(`"${word}"`), "word not in a guesser's view");
  assert.equal(gv.hint.length, word.length);
  s = ok(draw.apply(s, guesser, { guess: "definitely wrong" }, ctx(3000)));
  s = ok(draw.apply(s, guesser, { guess: word.toUpperCase() }, ctx(4000)));
  assert.ok(s.scores[guesser] > 100);
  assert.equal(s.scores[drawer], 50);
  assert.ok(!JSON.stringify(draw.view(s, (drawer + 2) % 3)).includes(`"${word}"`), "a correct guess isn't shown to others");
  err(draw.apply(s, drawer, { guess: `it's ${word}` }, ctx(4100)), /spoiler/i);
  const last = (drawer + 2) % 3;
  s = ok(draw.apply(s, last, { guess: word }, ctx(5000)));
  assert.equal(s.phase, "reveal", "everyone guessed");
  s = ok(draw.apply(s, guesser, { tick: true }, ctx(5000 + 5001)));
  assert.equal(s.phase, "choose");
  assert.notEqual(s.order[s.idx], drawer, "next drawer");
});

test("every rules module keeps state serializable", () => {
  for (const [id, rules] of Object.entries(RULES)) {
    const s = rules.init(id === "draw" ? 3 : 2, ctx(0, 5));
    assert.deepEqual(JSON.parse(JSON.stringify(s)), s, id);
  }
});

console.log(`✓ ${passed} rules tests passed`);

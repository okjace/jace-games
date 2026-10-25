import type { Rules } from "../types";

/**
 * Battleship on a 10×10 grid with ships of 5, 4, 3, 3 and 2. Both players
 * place their fleet (in secret), then take turns firing. A player only ever
 * sees their own ships plus the hits and misses on the other board; a ship
 * is revealed to the opponent once it's sunk.
 */

export const SIZE = 10;
export const FLEET = [5, 4, 3, 3, 2];

export type Ship = { x: number; y: number; len: number; dir: "h" | "v" };
export type BattleshipState = {
  ships: (Ship[] | null)[]; // per seat; null until placed
  shots: number[][]; // shots[seat] = cells that seat has fired at (on the other board)
  turn: number;
  winner: number | null;
  last: { seat: number; cell: number; hit: boolean; sunk: boolean } | null;
};
export type BattleshipMove = { place: Ship[] } | { fire: number };
export type BattleshipView = {
  phase: "place" | "fire" | "over";
  seat: number | null;
  placed: boolean[];
  /** My ships (empty for spectators until the end). */
  myShips: Ship[];
  /** Ships of the other player that are sunk (or all of them once it's over). */
  theirShips: Ship[];
  /** Shots at the other board, and at mine. */
  myShots: { cell: number; hit: boolean }[];
  theirShots: { cell: number; hit: boolean }[];
  turn: number;
  winner: number | null;
  last: BattleshipState["last"];
};

export const shipCells = (s: Ship) => Array.from({ length: s.len }, (_, i) => (s.dir === "h" ? s.y * SIZE + s.x + i : (s.y + i) * SIZE + s.x));

export function validFleet(ships: unknown): ships is Ship[] {
  if (!Array.isArray(ships) || ships.length !== FLEET.length) return false;
  const lens = ships.map((s) => (s as Ship)?.len).sort((a, b) => b - a);
  if (lens.join() !== FLEET.join()) return false;
  const used = new Set<number>();
  for (const s of ships as Ship[]) {
    if (!Number.isInteger(s.x) || !Number.isInteger(s.y) || (s.dir !== "h" && s.dir !== "v")) return false;
    if (s.x < 0 || s.y < 0 || (s.dir === "h" ? s.x + s.len > SIZE || s.y >= SIZE : s.y + s.len > SIZE || s.x >= SIZE)) return false;
    for (const c of shipCells(s)) {
      if (used.has(c)) return false;
      used.add(c);
    }
  }
  return true;
}

/** A random legal fleet, for the "Shuffle" button. */
export function randomFleet(rand: () => number = Math.random): Ship[] {
  for (;;) {
    const ships: Ship[] = [];
    const used = new Set<number>();
    for (const len of FLEET) {
      for (let t = 0; t < 200; t++) {
        const dir = rand() < 0.5 ? "h" : "v";
        const s: Ship = {
          len,
          dir,
          x: Math.floor(rand() * (dir === "h" ? SIZE - len + 1 : SIZE)),
          y: Math.floor(rand() * (dir === "v" ? SIZE - len + 1 : SIZE)),
        };
        if (shipCells(s).some((c) => used.has(c))) continue;
        shipCells(s).forEach((c) => used.add(c));
        ships.push(s);
        break;
      }
    }
    if (validFleet(ships)) return ships;
  }
}

const sunk = (ship: Ship, shots: number[]) => shipCells(ship).every((c) => shots.includes(c));

export const battleship: Rules<BattleshipState, BattleshipMove, BattleshipView> = {
  init: () => ({ ships: [null, null], shots: [[], []], turn: 0, winner: null, last: null }),
  apply(state, seat, move) {
    if (state.winner !== null) return { error: "The game is over." };
    if (move && "place" in move) {
      if (state.ships[seat]) return { error: "Your fleet is already placed." };
      if (!validFleet(move.place)) return { error: "Ships must fit on the board without overlapping." };
      const ships = [...state.ships];
      ships[seat] = move.place.map((s) => ({ x: s.x, y: s.y, len: s.len, dir: s.dir }));
      return { ...state, ships };
    }
    if (move && "fire" in move) {
      if (!state.ships[0] || !state.ships[1]) return { error: "Wait until both fleets are placed." };
      if (seat !== state.turn) return { error: "It's not your turn." };
      const cell = move.fire;
      if (!Number.isInteger(cell) || cell < 0 || cell >= SIZE * SIZE) return { error: "Pick a square." };
      if (state.shots[seat].includes(cell)) return { error: "You already fired there." };
      const shots = state.shots.map((s) => [...s]);
      shots[seat].push(cell);
      const enemy = state.ships[1 - seat]!;
      const ship = enemy.find((s) => shipCells(s).includes(cell));
      const allSunk = enemy.every((s) => sunk(s, shots[seat]));
      return {
        ...state,
        shots,
        turn: allSunk ? seat : 1 - seat,
        winner: allSunk ? seat : null,
        last: { seat, cell, hit: !!ship, sunk: !!ship && sunk(ship, shots[seat]) },
      };
    }
    return { error: "Unknown move." };
  },
  view(state, seat) {
    const me = seat ?? 0;
    const other = 1 - me;
    const over = state.winner !== null;
    const theirFleet = state.ships[other] ?? [];
    const myFleet = state.ships[me] ?? [];
    const mark = (shots: number[], fleet: Ship[]) => shots.map((cell) => ({ cell, hit: fleet.some((s) => shipCells(s).includes(cell)) }));
    return {
      phase: over ? "over" : state.ships[0] && state.ships[1] ? "fire" : "place",
      seat,
      placed: state.ships.map(Boolean),
      myShips: seat === null && !over ? [] : myFleet,
      theirShips: over ? theirFleet : theirFleet.filter((s) => sunk(s, state.shots[me])),
      myShots: mark(state.shots[me], theirFleet),
      theirShots: mark(state.shots[other], myFleet),
      turn: state.turn,
      winner: state.winner,
      last: state.last,
    };
  },
  status(s) {
    if (s.winner !== null) return { over: true, winners: [s.winner] };
    if (!s.ships[0] || !s.ships[1]) return { over: false, turn: [0, 1].filter((i) => !s.ships[i]) };
    return { over: false, turn: [s.turn] };
  },
};

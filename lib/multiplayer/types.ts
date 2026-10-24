/**
 * Turn-based games are run by the server: each has a pure rules module
 * (lib/multiplayer/rules) that both the server and the browser use. The
 * server keeps the real state in the room and only ever sends each player
 * `view(state, seat)`, so hidden things (ships, the secret word) stay hidden.
 */

export type Ctx = {
  /** Server time in ms. */
  now: number;
  /** Deterministic random numbers in [0, 1) for this move. */
  rng: () => number;
};

export type Status = { over: false; turn: number[] } | { over: true; winners: number[] };

export type Rules<S = unknown, M = unknown, V = unknown> = {
  init: (seats: number, ctx: Ctx) => S;
  /** Applies `move` by `seat`, or returns why it isn't allowed. Must not mutate `state`. */
  apply: (state: S, seat: number, move: M, ctx: Ctx) => S | { error: string };
  /** What `seat` (null = a spectator) is allowed to see. */
  view: (state: S, seat: number | null) => V;
  status: (state: S) => Status;
};

export function isError(x: unknown): x is { error: string } {
  return !!x && typeof x === "object" && "error" in x && typeof (x as { error: unknown }).error === "string";
}

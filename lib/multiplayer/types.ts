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
  /**
   * How much players may see, which decides what can travel over the room's
   * live channel (everyone in the room can read it):
   * - "full": view() is the whole state for everyone, so the new state can be
   *   pushed to all players and a mover's own browser can apply moves at once.
   * - "public": view() is the same for every seat (but hides things), so it
   *   can be pushed to everyone.
   * - unset: views differ per seat; players fetch their own after a change.
   */
  openness?: "full" | "public";
  /** Optional: someone left a game with 3+ players. Default: the game ends. */
  forfeit?: (state: S, seat: number, ctx: Ctx) => S;
};

export function isError(x: unknown): x is { error: string } {
  return !!x && typeof x === "object" && "error" in x && typeof (x as { error: unknown }).error === "string";
}

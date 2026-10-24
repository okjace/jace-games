"use client";

import { useCallback, useState } from "react";
import { RULES } from "./registry";
import { seededRandom } from "./rng";
import { isError, type Ctx } from "./types";

/** Pass-and-play: runs a turn-based game's rules in the browser for players sharing one device. */
export function useLocalGame(gameId: string, seats: number) {
  const rules = RULES[gameId];
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 2 ** 31));
  const [moves, setMoves] = useState(0);
  const ctx = useCallback((n: number): Ctx => ({ now: Date.now(), rng: seededRandom(seed + n * 7919) }), [seed]);
  const [state, setState] = useState<unknown>(() => rules.init(seats, { now: Date.now(), rng: seededRandom(seed) }));
  const [error, setError] = useState<string | null>(null);

  const move = useCallback(
    (seat: number, m: unknown) => {
      const next = rules.apply(state, seat, m, ctx(moves + 1));
      if (isError(next)) {
        setError(next.error);
        return false;
      }
      setError(null);
      setState(next);
      setMoves((n) => n + 1);
      return true;
    },
    [rules, state, ctx, moves],
  );

  const reset = useCallback(() => {
    const s = Math.floor(Math.random() * 2 ** 31);
    setSeed(s);
    setMoves(0);
    setError(null);
    setState(rules.init(seats, { now: Date.now(), rng: seededRandom(s) }));
  }, [rules, seats]);

  return { state, status: rules.status(state), view: (seat: number | null) => rules.view(state, seat), move, reset, error };
}

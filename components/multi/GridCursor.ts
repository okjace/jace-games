"use client";

import { useState } from "react";
import { useKeys } from "@/components/games/shared";

/** A keyboard cursor on an N×N board: arrow keys move it, Enter or Space picks the square. */
export function useGridCursor(size: number, onPick: (cell: number) => void, enabled: boolean, start = 0) {
  const [cursor, setCursor] = useState(start);
  const [usingKeys, setUsingKeys] = useState(false);
  useKeys((e) => {
    if (!enabled) return;
    const r = Math.floor(cursor / size);
    const c = cursor % size;
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (moves[e.key]) {
      const [dr, dc] = moves[e.key];
      setCursor(((r + dr + size) % size) * size + ((c + dc + size) % size));
      setUsingKeys(true);
    } else if (e.key === "Enter" || e.key === " ") {
      onPick(cursor);
      setUsingKeys(true);
    } else return;
    e.preventDefault();
  });
  return { cursor: usingKeys ? cursor : -1, setCursor };
}

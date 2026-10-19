"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameOver, now, Overlay, Stats, beats, primaryButton, type GameProps } from "./shared";

const SIZE = 9;
const MINES = 10;

type Cell = { mine: boolean; open: boolean; flag: boolean; near: number };

const neighbours = (i: number) => {
  const x = i % SIZE;
  const y = Math.floor(i / SIZE);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE) out.push(ny * SIZE + nx);
    }
  return out;
};

const emptyBoard = (): Cell[] =>
  Array.from({ length: SIZE * SIZE }, () => ({ mine: false, open: false, flag: false, near: 0 }));

/** Places mines anywhere except the first cell clicked and its neighbours. */
function placeMines(board: Cell[], safe: number): Cell[] {
  const banned = new Set([safe, ...neighbours(safe)]);
  const spots = board.map((_, i) => i).filter((i) => !banned.has(i));
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  const mines = new Set(spots.slice(0, MINES));
  return board.map((c, i) => ({
    ...c,
    mine: mines.has(i),
    near: neighbours(i).filter((n) => mines.has(n)).length,
  }));
}

function flood(board: Cell[], start: number): Cell[] {
  const next = board.map((c) => ({ ...c }));
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    const c = next[i];
    if (c.open || c.flag) continue;
    c.open = true;
    if (c.near === 0 && !c.mine) stack.push(...neighbours(i));
  }
  return next;
}

const NUM_COLORS = ["", "text-sky-400", "text-accent", "text-danger", "text-violet-400", "text-amber-500", "text-cyan-400", "text-foreground", "text-muted"];

export default function Minesweeper({ onFinish, best }: GameProps) {
  const [board, setBoard] = useState<Cell[]>(emptyBoard);
  const [state, setState] = useState<"ready" | "playing" | "won" | "lost">("ready");
  const [flagMode, setFlagMode] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [wasBest, setWasBest] = useState(false);
  const startedAt = useRef(0);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const longPress = useRef<{ timer: ReturnType<typeof setTimeout> | null; fired: boolean }>({ timer: null, fired: false });

  useEffect(() => {
    if (state !== "playing") return;
    const t = setInterval(() => setElapsed(Math.floor((now() - startedAt.current) / 1000)), 250);
    return () => clearInterval(t);
  }, [state]);

  const reset = useCallback(() => {
    setBoard(emptyBoard());
    setState("ready");
    setElapsed(0);
  }, []);

  const finishIfWon = (b: Cell[]) => {
    if (b.every((c) => c.mine || c.open)) {
      const ms = now() - startedAt.current;
      const secs = Math.max(1, Math.ceil(ms / 1000));
      setElapsed(secs);
      setState("won");
      setWasBest(beats(secs, best, "lower"));
      setBoard(b.map((c) => (c.mine ? { ...c, flag: true } : c)));
      onFinish(secs, ms);
      return true;
    }
    return false;
  };

  const reveal = (i: number) => {
    if (state === "won" || state === "lost") return;
    let b = board;
    if (state === "ready") {
      b = placeMines(board, i);
      startedAt.current = now();
      setState("playing");
    }
    const cell = b[i];
    if (cell.flag) return;

    // Chord: clicking an open number with that many flags around opens the rest.
    let targets = [i];
    if (cell.open) {
      if (cell.near === 0) return;
      const ns = neighbours(i);
      if (ns.filter((n) => b[n].flag).length !== cell.near) return;
      targets = ns.filter((n) => !b[n].flag && !b[n].open);
    }

    for (const t of targets) {
      if (b[t].mine) {
        setBoard(b.map((c, k) => (c.mine || k === t ? { ...c, open: true } : c)));
        setState("lost");
        return;
      }
      b = flood(b, t);
    }
    setBoard(b);
    finishIfWon(b);
  };

  const toggleFlag = (i: number) => {
    if (state !== "playing" || board[i].open) return;
    setBoard(board.map((c, k) => (k === i ? { ...c, flag: !c.flag } : c)));
  };

  const onCellKey = (e: React.KeyboardEvent, i: number) => {
    const x = i % SIZE;
    const y = Math.floor(i / SIZE);
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      const nx = (x + dx + SIZE) % SIZE;
      const ny = (y + dy + SIZE) % SIZE;
      cellRefs.current[ny * SIZE + nx]?.focus();
    } else if (e.key === "f" || e.key === "F") {
      e.preventDefault();
      toggleFlag(i);
    }
  };

  const flags = board.filter((c) => c.flag).length;

  return (
    <div className="flex flex-col items-center gap-4">
      <Stats
        items={[
          { label: "Mines", value: MINES - flags },
          { label: "Time", value: `${elapsed}s` },
          { label: "Best", value: best != null ? `${best}s` : "—", accent: true },
        ]}
      />
      <div className="relative w-full max-w-[420px]">
        <div
          className="touch-game grid gap-1 rounded-2xl border border-line bg-panel p-2"
          style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
          role="grid"
          aria-label="Minefield"
          onContextMenu={(e) => e.preventDefault()}
        >
          {board.map((c, i) => (
            <button
              key={i}
              ref={(el) => {
                cellRefs.current[i] = el;
              }}
              type="button"
              onKeyDown={(e) => onCellKey(e, i)}
              onClick={() => {
                if (longPress.current.fired) return;
                if (flagMode && !c.open) toggleFlag(i);
                else reveal(i);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                toggleFlag(i);
              }}
              onPointerDown={(e) => {
                longPress.current.fired = false;
                if (e.pointerType === "mouse") return;
                longPress.current.timer = setTimeout(() => {
                  longPress.current.fired = true;
                  toggleFlag(i);
                  navigator.vibrate?.(20);
                }, 400);
              }}
              onPointerUp={() => longPress.current.timer && clearTimeout(longPress.current.timer)}
              onPointerLeave={() => longPress.current.timer && clearTimeout(longPress.current.timer)}
              aria-label={c.open ? (c.mine ? "Mine" : c.near ? `${c.near}` : "Empty") : c.flag ? "Flagged" : "Hidden"}
              className={`flex aspect-square items-center justify-center rounded-md text-base font-bold select-none focus-visible:outline-2 focus-visible:outline-accent sm:text-lg ${
                c.open
                  ? c.mine
                    ? "bg-danger/30"
                    : `bg-foreground/[.03] ${NUM_COLORS[c.near]}`
                  : "bg-foreground/[.1] hover:bg-foreground/[.16]"
              }`}
            >
              {c.open ? (c.mine ? "💣" : c.near || "") : c.flag ? "🚩" : ""}
            </button>
          ))}
        </div>
        {state === "lost" && (
          <Overlay>
            <p className="text-2xl font-bold">Boom!</p>
            <p className="text-sm text-muted">Only cleared boards count. Try again?</p>
            <button type="button" onClick={reset} className={primaryButton} autoFocus>
              Play again
            </button>
          </Overlay>
        )}
        {state === "won" && <GameOver title="Field cleared!" score={`${elapsed}s`} isBest={wasBest} onAgain={reset} />}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setFlagMode((f) => !f)}
          aria-pressed={flagMode}
          className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors ${
            flagMode ? "border-accent bg-accent text-on-accent" : "border-line bg-panel hover:bg-foreground/[.05]"
          }`}
        >
          🚩 Flag mode {flagMode ? "on" : "off"}
        </button>
      </div>
      <p className="max-w-md text-center text-xs text-muted">
        Click to reveal, right-click to flag. On a phone, tap to reveal and long-press (or use flag mode) to flag.
        Keyboard: arrow keys to move, Enter to reveal, F to flag. Your first click is always safe.
      </p>
    </div>
  );
}

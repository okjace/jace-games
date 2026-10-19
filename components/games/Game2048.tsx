"use client";

import { useCallback, useRef, useState } from "react";
import { GameOver, Stats, beats, keyToDir, secondaryButton, useKeys, useSwipe, type Dir, type GameProps } from "./shared";

const N = 4;
type Board = number[]; // N*N, 0 = empty

function addTile(board: Board): Board {
  const empty = board.flatMap((v, i) => (v === 0 ? [i] : []));
  if (empty.length === 0) return board;
  const next = [...board];
  next[empty[Math.floor(Math.random() * empty.length)]] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

function newBoard(): Board {
  return addTile(addTile(Array(N * N).fill(0)));
}

/** Slides one row toward index 0, merging equal neighbours once. */
function slideRow(row: number[]): { row: number[]; gained: number } {
  const tiles = row.filter((v) => v !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === tiles[i + 1]) {
      out.push(tiles[i] * 2);
      gained += tiles[i] * 2;
      i++;
    } else out.push(tiles[i]);
  }
  while (out.length < N) out.push(0);
  return { row: out, gained };
}

function move(board: Board, dir: Dir): { board: Board; gained: number; moved: boolean } {
  const next = [...board];
  let gained = 0;
  for (let k = 0; k < N; k++) {
    const idx: number[] = [];
    for (let j = 0; j < N; j++) {
      if (dir === "left") idx.push(k * N + j);
      if (dir === "right") idx.push(k * N + (N - 1 - j));
      if (dir === "up") idx.push(j * N + k);
      if (dir === "down") idx.push((N - 1 - j) * N + k);
    }
    const res = slideRow(idx.map((i) => board[i]));
    gained += res.gained;
    idx.forEach((i, j) => (next[i] = res.row[j]));
  }
  return { board: next, gained, moved: next.some((v, i) => v !== board[i]) };
}

function canMove(board: Board): boolean {
  return (["left", "right", "up", "down"] as Dir[]).some((d) => move(board, d).moved);
}

const TILE_STYLES: Record<number, string> = {
  2: "bg-foreground/[.08]",
  4: "bg-foreground/[.14]",
  8: "bg-accent/25",
  16: "bg-accent/35",
  32: "bg-accent/45",
  64: "bg-accent/55",
  128: "bg-accent/70 text-on-accent",
  256: "bg-accent/80 text-on-accent",
  512: "bg-accent/90 text-on-accent",
  1024: "bg-accent text-on-accent",
  2048: "bg-accent text-on-accent ring-4 ring-accent/40",
};

export default function Game2048({ onFinish, best }: GameProps) {
  const [board, setBoard] = useState<Board>(() => newBoard());
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [wasBest, setWasBest] = useState(false);
  const [lastNew, setLastNew] = useState<number | null>(null);
  const startedAt = useRef<number | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const finish = useCallback(
    (finalScore: number) => {
      setOver(true);
      setWasBest(finalScore > 0 && beats(finalScore, best, "higher"));
      onFinish(finalScore, performance.now() - (startedAt.current ?? performance.now()));
    },
    [best, onFinish],
  );

  const doMove = useCallback(
    (dir: Dir) => {
      if (over) return;
      const res = move(board, dir);
      if (!res.moved) return;
      if (startedAt.current === null) startedAt.current = performance.now();
      const withTile = addTile(res.board);
      setLastNew(withTile.findIndex((v, i) => v !== 0 && res.board[i] === 0));
      setBoard(withTile);
      const s = score + res.gained;
      setScore(s);
      if (!canMove(withTile)) finish(s);
    },
    [board, over, score, finish],
  );

  const reset = useCallback(() => {
    setBoard(newBoard());
    setScore(0);
    setOver(false);
    setLastNew(null);
    startedAt.current = null;
  }, []);

  useKeys((e) => {
    const d = keyToDir(e.key);
    if (d) {
      e.preventDefault();
      doMove(d);
    } else if (over && e.key === "Enter") reset();
  });
  useSwipe(boardRef, doMove);

  const maxTile = Math.max(...board);

  return (
    <div className="flex flex-col items-center gap-4">
      <Stats
        items={[
          { label: "Score", value: score.toLocaleString() },
          { label: "Best", value: best?.toLocaleString() ?? "—", accent: true },
        ]}
      />
      <div
        ref={boardRef}
        className="touch-game relative grid aspect-square w-full max-w-[440px] grid-cols-4 gap-2 rounded-2xl border border-line bg-panel p-2 sm:gap-3 sm:p-3"
        aria-label={`2048 board. Highest tile ${maxTile}. Use the arrow keys or swipe.`}
        role="application"
      >
        {board.map((v, i) => (
          <div
            key={`${i}-${v}`}
            className={`flex items-center justify-center rounded-xl font-bold tabular-nums ${
              v === 0 ? "bg-foreground/[.03]" : (TILE_STYLES[v] ?? "bg-accent text-on-accent")
            } ${v >= 1024 ? "text-xl sm:text-2xl" : v >= 128 ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"} ${
              i === lastNew ? "animate-pop" : ""
            }`}
          >
            {v || ""}
          </div>
        ))}
        {over && <GameOver score={score.toLocaleString()} isBest={wasBest} onAgain={reset} extra={<p className="text-sm text-muted">Highest tile: {maxTile}</p>} />}
      </div>
      <div className="flex flex-col items-center gap-2">
        {!over && score > 0 && (
          <button type="button" onClick={() => finish(score)} className={secondaryButton}>
            End game &amp; save score
          </button>
        )}
        <p className="text-xs text-muted">Arrow keys or WASD. On a phone, swipe the board.</p>
      </div>
    </div>
  );
}

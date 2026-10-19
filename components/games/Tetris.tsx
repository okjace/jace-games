"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameOver, Overlay, Stats, beats, primaryButton, setupCanvas, themeColors, useKeys, type GameProps } from "./shared";

const COLS = 10;
const ROWS = 20;
const CELL = 24;
const W = COLS * CELL;
const H = ROWS * CELL;

type Shape = number[][];
const SHAPES: Record<string, Shape> = {
  I: [[1, 1, 1, 1]],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
  ],
};
const COLORS: Record<string, string> = {
  I: "#38bdf8",
  O: "#facc15",
  T: "#a78bfa",
  S: "#3ddc84",
  Z: "#f87171",
  J: "#60a5fa",
  L: "#fb923c",
};
const LINE_POINTS = [0, 100, 300, 500, 800];

type Piece = { kind: string; shape: Shape; x: number; y: number };

const rotate = (s: Shape): Shape => s[0].map((_, i) => s.map((row) => row[i]).reverse());
const rotateCcw = (s: Shape): Shape => rotate(rotate(rotate(s)));

function bag(): string[] {
  const b = Object.keys(SHAPES);
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function spawn(kind: string): Piece {
  const shape = SHAPES[kind];
  return { kind, shape, x: Math.floor((COLS - shape[0].length) / 2), y: kind === "I" ? 0 : -1 };
}

export default function Tetris({ onFinish, best }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nextRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"idle" | "running" | "paused" | "over">("idle");
  const [hud, setHud] = useState({ score: 0, lines: 0, level: 0 });
  const [wasBest, setWasBest] = useState(false);

  const g = useRef({
    grid: [] as (string | null)[][],
    piece: spawn("T"),
    queue: [] as string[],
    score: 0,
    lines: 0,
    startedAt: 0,
    dropAcc: 0,
    last: 0,
  });

  const collides = (p: Piece, grid = g.current.grid) =>
    p.shape.some((row, dy) =>
      row.some((v, dx) => {
        if (!v) return false;
        const x = p.x + dx;
        const y = p.y + dy;
        return x < 0 || x >= COLS || y >= ROWS || (y >= 0 && grid[y][x] !== null);
      }),
    );

  const nextKind = () => {
    const s = g.current;
    if (s.queue.length < 2) s.queue.push(...bag());
    return s.queue.shift()!;
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const c = themeColors();
    const s = g.current;
    ctx.fillStyle = c.panel;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = c.line;
    ctx.lineWidth = 1;
    for (let x = 1; x < COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL + 0.5, 0);
      ctx.lineTo(x * CELL + 0.5, H);
      ctx.stroke();
    }
    const cell = (x: number, y: number, color: string, alpha = 1) => {
      if (y < 0) return;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2, 4);
      ctx.fill();
      ctx.globalAlpha = 1;
    };
    s.grid.forEach((row, y) => row.forEach((k, x) => k && cell(x, y, COLORS[k])));
    if (s.grid.length) {
      // Ghost piece shows where a hard drop lands.
      const ghost = { ...s.piece };
      while (!collides({ ...ghost, y: ghost.y + 1 })) ghost.y++;
      ghost.shape.forEach((row, dy) => row.forEach((v, dx) => v && cell(ghost.x + dx, ghost.y + dy, COLORS[s.piece.kind], 0.22)));
      s.piece.shape.forEach((row, dy) => row.forEach((v, dx) => v && cell(s.piece.x + dx, s.piece.y + dy, COLORS[s.piece.kind])));
    }
    // Next piece preview.
    const nc = nextRef.current;
    if (nc && s.queue.length) {
      const nctx = nc.getContext("2d")!;
      nctx.clearRect(0, 0, 80, 60);
      const shape = SHAPES[s.queue[0]];
      const size = 16;
      const ox = (80 - shape[0].length * size) / 2;
      const oy = (60 - shape.length * size) / 2;
      nctx.fillStyle = COLORS[s.queue[0]];
      shape.forEach((row, dy) =>
        row.forEach((v, dx) => {
          if (!v) return;
          nctx.beginPath();
          nctx.roundRect(ox + dx * size + 1, oy + dy * size + 1, size - 2, size - 2, 3);
          nctx.fill();
        }),
      );
    }
  }, []);

  useEffect(() => {
    if (canvasRef.current) setupCanvas(canvasRef.current, W, H);
    if (nextRef.current) setupCanvas(nextRef.current, 80, 60);
    draw();
    const obs = new MutationObserver(draw);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, [draw]);

  const level = () => Math.floor(g.current.lines / 10);

  const end = useCallback(() => {
    const s = g.current;
    setPhase("over");
    setWasBest(s.score > 0 && beats(s.score, best, "higher"));
    onFinish(s.score, performance.now() - s.startedAt);
  }, [best, onFinish]);

  /** Locks the current piece, clears lines, spawns the next. Returns false on top-out. */
  const lock = () => {
    const s = g.current;
    let toppedOut = false;
    s.piece.shape.forEach((row, dy) =>
      row.forEach((v, dx) => {
        if (!v) return;
        const y = s.piece.y + dy;
        if (y < 0) toppedOut = true;
        else s.grid[y][s.piece.x + dx] = s.piece.kind;
      }),
    );
    if (toppedOut) return false;
    const kept = s.grid.filter((row) => row.some((c) => c === null));
    const cleared = ROWS - kept.length;
    if (cleared > 0) {
      s.score += LINE_POINTS[cleared] * (level() + 1);
      s.lines += cleared;
      s.grid = [...Array.from({ length: cleared }, () => Array<string | null>(COLS).fill(null)), ...kept];
    }
    s.piece = spawn(nextKind());
    setHud({ score: s.score, lines: s.lines, level: level() });
    return !collides(s.piece);
  };

  const act = (a: "left" | "right" | "down" | "drop" | "rotate" | "rotateCcw") => {
    const s = g.current;
    if (phase !== "running") return;
    const p = s.piece;
    if (a === "left" || a === "right") {
      const moved = { ...p, x: p.x + (a === "left" ? -1 : 1) };
      if (!collides(moved)) s.piece = moved;
    } else if (a === "rotate" || a === "rotateCcw") {
      const shape = a === "rotate" ? rotate(p.shape) : rotateCcw(p.shape);
      for (const kick of [0, -1, 1, -2, 2]) {
        const r = { ...p, shape, x: p.x + kick };
        if (!collides(r)) {
          s.piece = r;
          break;
        }
      }
    } else if (a === "down") {
      const moved = { ...p, y: p.y + 1 };
      if (!collides(moved)) {
        s.piece = moved;
        s.score += 1;
        s.dropAcc = 0;
        setHud((h) => ({ ...h, score: s.score }));
      }
    } else if (a === "drop") {
      let dist = 0;
      while (!collides({ ...s.piece, y: s.piece.y + 1 })) {
        s.piece = { ...s.piece, y: s.piece.y + 1 };
        dist++;
      }
      s.score += dist * 2;
      s.dropAcc = 0;
      if (!lock()) {
        draw();
        return end();
      }
    }
    draw();
  };

  const start = useCallback(() => {
    const s = g.current;
    s.grid = Array.from({ length: ROWS }, () => Array<string | null>(COLS).fill(null));
    s.queue = bag();
    s.piece = spawn(s.queue.shift()!);
    s.score = 0;
    s.lines = 0;
    s.startedAt = performance.now();
    s.dropAcc = 0;
    setHud({ score: 0, lines: 0, level: 0 });
    setPhase("running");
  }, []);

  useEffect(() => {
    if (phase !== "running") return;
    const s = g.current;
    s.last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      s.dropAcc += now - s.last;
      s.last = now;
      const interval = Math.max(80, 800 - level() * 70);
      if (s.dropAcc >= interval) {
        s.dropAcc = 0;
        const moved = { ...s.piece, y: s.piece.y + 1 };
        if (!collides(moved)) s.piece = moved;
        else if (!lock()) {
          draw();
          return end();
        }
      }
      draw();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, draw, end]);

  useKeys((e) => {
    const map: Record<string, Parameters<typeof act>[0]> = {
      ArrowLeft: "left",
      a: "left",
      ArrowRight: "right",
      d: "right",
      ArrowDown: "down",
      s: "down",
      ArrowUp: "rotate",
      w: "rotate",
      x: "rotate",
      z: "rotateCcw",
      " ": "drop",
    };
    if (phase === "running") {
      if (map[e.key]) {
        e.preventDefault();
        act(map[e.key]);
      } else if (e.key === "p" || e.key === "Escape") setPhase("paused");
    } else if (phase === "paused" && (e.key === "p" || e.key === "Escape" || e.key === "Enter")) {
      setPhase("running");
    } else if ((phase === "idle" || phase === "over") && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      start();
    }
  });

  // Touch buttons repeat while held (except rotate and drop).
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function hold(e: React.PointerEvent, a: Parameters<typeof act>[0]) {
    e.preventDefault();
    act(a);
    if (a === "rotate" || a === "drop") return;
    const repeat = (delay: number) => {
      holdTimer.current = setTimeout(() => {
        act(a);
        repeat(60);
      }, delay);
    };
    repeat(200);
  }
  function release() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }
  const touchBtn =
    "flex h-14 flex-1 items-center justify-center rounded-2xl border border-line bg-panel text-xl active:bg-accent active:text-on-accent select-none";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-[420px] items-start justify-center gap-3">
        <div
          className="touch-game relative w-full"
          style={{ aspectRatio: `${COLS} / ${ROWS}`, maxWidth: `min(260px, calc(68vh * ${COLS / ROWS}))` }}
        >
          <canvas
            ref={canvasRef}
            className="h-full w-full rounded-2xl border border-line"
            aria-label="Block stacker board"
            onPointerDown={(e) => {
              if (e.pointerType !== "mouse" && phase === "running") act("rotate");
            }}
          />
          {phase === "idle" && (
            <Overlay>
              <p className="text-sm text-muted">← → move · ↑ rotate · ↓ soft drop · Space hard drop · P pause</p>
              <button type="button" onClick={start} className={primaryButton}>
                Start
              </button>
            </Overlay>
          )}
          {phase === "paused" && (
            <Overlay>
              <p className="text-lg font-semibold">Paused</p>
              <button type="button" onClick={() => setPhase("running")} className={primaryButton}>
                Resume
              </button>
            </Overlay>
          )}
          {phase === "over" && (
            <GameOver score={hud.score.toLocaleString()} isBest={wasBest} onAgain={start} extra={<p className="text-sm text-muted">{hud.lines} lines</p>} />
          )}
        </div>
        <div className="flex w-24 shrink-0 flex-col gap-2 text-sm">
          <div className="rounded-xl border border-line bg-panel p-2">
            <p className="text-xs text-muted">Next</p>
            <canvas ref={nextRef} className="h-[60px] w-[80px]" />
          </div>
          <Stats
            items={[
              { label: "Score", value: hud.score.toLocaleString() },
              { label: "Lines", value: hud.lines },
              { label: "Level", value: hud.level + 1 },
              { label: "Best", value: best?.toLocaleString() ?? "—", accent: true },
            ]}
          />
          {phase === "running" && (
            <button
              type="button"
              onClick={() => setPhase("paused")}
              className="rounded-xl border border-line bg-panel px-3 py-1.5 text-sm hover:bg-foreground/[.05]"
            >
              Pause
            </button>
          )}
        </div>
      </div>
      <div className="touch-game flex w-full max-w-[420px] gap-2 [@media(pointer:fine)]:hidden" aria-hidden="true">
        <button type="button" tabIndex={-1} className={touchBtn} onPointerDown={(e) => hold(e, "left")} onPointerUp={release} onPointerLeave={release}>
          ◀
        </button>
        <button type="button" tabIndex={-1} className={touchBtn} onPointerDown={(e) => hold(e, "rotate")}>
          ⟳
        </button>
        <button type="button" tabIndex={-1} className={touchBtn} onPointerDown={(e) => hold(e, "down")} onPointerUp={release} onPointerLeave={release}>
          ▼
        </button>
        <button type="button" tabIndex={-1} className={touchBtn} onPointerDown={(e) => hold(e, "drop")}>
          ⤓
        </button>
        <button type="button" tabIndex={-1} className={touchBtn} onPointerDown={(e) => hold(e, "right")} onPointerUp={release} onPointerLeave={release}>
          ▶
        </button>
      </div>
    </div>
  );
}

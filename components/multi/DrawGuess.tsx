"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { setupCanvas } from "@/components/games/shared";
import type { DrawMove, DrawView } from "@/lib/multiplayer/rules/draw";
import { SEAT_COLORS, type TurnGameProps } from "./types";

const W = 640;
const H = 480;
const COLORS = ["#111317", "#ffffff", "#f87171", "#fb923c", "#facc15", "#3ddc84", "#38bdf8", "#a78bfa", "#f472b6", "#8b5a2b"];
const SIZES = [3, 8, 18];

type Stroke = { id: string; color: string; size: number; pts: [number, number][] };

export default function DrawGuess({ view, seat, players, onMove, busy, channel, clockSkew = 0 }: TurnGameProps<DrawView, DrawMove>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);
  const pendingPts = useRef<[number, number][]>([]);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [guess, setGuess] = useState("");
  const [left, setLeft] = useState(0);
  const chatRef = useRef<HTMLDivElement>(null);
  const drawer = view.drawer;
  const iDraw = seat === drawer && view.phase === "draw";
  const name = (s: number) => players.find((p) => p.seat === s)?.name ?? `Player ${s + 1}`;

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of strokes.current) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size;
      ctx.beginPath();
      s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H)));
      if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] * W + 0.1, s.pts[0][1] * H);
      ctx.stroke();
    }
  }, []);

  useEffect(() => {
    if (canvasRef.current) setupCanvas(canvasRef.current, W, H);
    redraw();
  }, [redraw]);

  // A new turn starts with a blank canvas.
  useEffect(() => {
    strokes.current = [];
    current.current = null;
    redraw();
  }, [view.idx, redraw]);

  // Strokes from the drawer arrive over the room channel.
  useEffect(() => {
    if (!channel) return;
    const offs = [
      channel.on("stroke", (p) => {
        const { id, color, size, pts, turn } = p as Stroke & { turn: number };
        if (turn !== view.idx || seat === drawer || !Array.isArray(pts)) return;
        let s = strokes.current.find((x) => x.id === id);
        if (!s) {
          s = { id, color, size, pts: [] };
          strokes.current.push(s);
        }
        s.pts.push(...pts.slice(0, 200));
        redraw();
      }),
      channel.on("clear", (p) => {
        if ((p as { turn: number }).turn !== view.idx || seat === drawer) return;
        strokes.current = [];
        redraw();
      }),
      channel.on("undo", (p) => {
        if ((p as { turn: number }).turn !== view.idx || seat === drawer) return;
        strokes.current.pop();
        redraw();
      }),
      // Someone (re)joined mid-turn: the drawer sends everything so far.
      channel.on("strokes?", () => {
        if (seat === drawer) channel.send("strokes", { turn: view.idx, strokes: strokes.current });
      }),
      channel.on("strokes", (p) => {
        const { turn, strokes: list } = p as { turn: number; strokes: Stroke[] };
        if (turn !== view.idx || seat === drawer || !Array.isArray(list) || strokes.current.length) return;
        strokes.current = list.slice(0, 2000);
        redraw();
      }),
    ];
    if (seat !== drawer) channel.send("strokes?", {});
    return () => offs.forEach((off) => off());
  }, [channel, view.idx, seat, drawer, redraw]);

  // Send buffered points a few times a second while drawing.
  useEffect(() => {
    if (!iDraw || !channel) return;
    const t = setInterval(() => {
      const s = current.current;
      if (!s || !pendingPts.current.length) return;
      channel.send("stroke", { id: s.id, color: s.color, size: s.size, pts: pendingPts.current, turn: view.idx });
      pendingPts.current = [];
    }, 60);
    return () => clearInterval(t);
  }, [iDraw, channel, view.idx]);

  const point = (e: React.PointerEvent): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };
  const down = (e: React.PointerEvent) => {
    if (!iDraw) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = point(e);
    current.current = { id: `${seat}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, color, size, pts: [p] };
    strokes.current.push(current.current);
    pendingPts.current = [p];
    redraw();
  };
  const move = (e: React.PointerEvent) => {
    if (!iDraw || !current.current) return;
    const p = point(e);
    current.current.pts.push(p);
    pendingPts.current.push(p);
    redraw();
  };
  const up = () => {
    const s = current.current;
    if (s && pendingPts.current.length) channel?.send("stroke", { id: s.id, color: s.color, size: s.size, pts: pendingPts.current, turn: view.idx });
    pendingPts.current = [];
    current.current = null;
  };
  const clear = () => {
    strokes.current = [];
    redraw();
    channel?.send("clear", { turn: view.idx });
  };
  const undo = () => {
    strokes.current.pop();
    redraw();
    channel?.send("undo", { turn: view.idx });
  };

  // Countdown; when it hits zero, nudge the server to move on.
  useEffect(() => {
    let sent = false;
    const t = setInterval(() => {
      const ms = view.deadline - (Date.now() + clockSkew);
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
      if (ms <= 0 && !sent) {
        sent = true;
        onMove({ tick: true });
      }
    }, 250);
    return () => clearInterval(t);
    // onMove changes every render; the deadline is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.deadline, clockSkew]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight });
  }, [view.chat.length]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const text = guess.trim();
    if (!text) return;
    onMove({ guess: text });
    setGuess("");
  };

  const banner =
    view.phase === "over"
      ? "Game over!"
      : view.phase === "choose"
        ? seat === drawer
          ? "Pick a word to draw"
          : `${name(drawer)} is picking a word…`
        : view.phase === "reveal"
          ? `The word was “${view.lastWord}”`
          : seat === drawer
            ? `Draw: ${view.word}`
            : view.word
              ? `You got it: ${view.word}!`
              : view.hint.split("").join(" ");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-panel px-4 py-2">
        <span className="text-sm text-muted">
          Turn {Math.min(view.idx + 1, view.order.length)}/{view.order.length}
        </span>
        <span className="font-mono text-lg font-bold tracking-widest" aria-live="polite">
          {banner}
        </span>
        <span className={`font-mono text-lg font-bold tabular-nums ${left <= 10 && view.phase === "draw" ? "text-danger" : ""}`}>{view.phase === "over" ? "" : `${left}s`}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="flex flex-col gap-2">
          <div className="relative">
            <canvas
              ref={canvasRef}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              className={`touch-game aspect-[4/3] w-full rounded-xl border border-line ${iDraw ? "cursor-crosshair" : ""}`}
              aria-label={iDraw ? "Drawing canvas" : `${name(drawer)}'s drawing`}
            />
            {view.phase === "choose" && seat === drawer && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-background/80 backdrop-blur-sm">
                <p className="font-semibold">Pick a word</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {view.choices.map((w, i) => (
                    <button
                      key={w}
                      type="button"
                      autoFocus={i === 0}
                      disabled={busy}
                      onClick={() => onMove({ choose: i })}
                      className="h-11 rounded-full bg-accent px-5 text-sm font-semibold text-on-accent hover:bg-accent-hover"
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {iDraw && (
            <div className="flex flex-wrap items-center gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full border-2 ${color === c ? "border-accent" : "border-line"}`}
                  style={{ background: c }}
                />
              ))}
              <span className="mx-1 h-6 w-px bg-line" />
              {SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-label={`Brush size ${s}`}
                  aria-pressed={size === s}
                  onClick={() => setSize(s)}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border ${size === s ? "border-accent" : "border-line"} bg-panel`}
                >
                  <span className="rounded-full bg-foreground" style={{ width: Math.min(20, s), height: Math.min(20, s) }} />
                </button>
              ))}
              <span className="mx-1 h-6 w-px bg-line" />
              <button type="button" onClick={() => setColor("#ffffff")} className="h-8 rounded-full border border-line bg-panel px-3 text-xs">
                Eraser
              </button>
              <button type="button" onClick={undo} className="h-8 rounded-full border border-line bg-panel px-3 text-xs">
                Undo
              </button>
              <button type="button" onClick={clear} className="h-8 rounded-full border border-line bg-panel px-3 text-xs">
                Clear
              </button>
            </div>
          )}
        </div>
        <div className="flex min-h-64 flex-col gap-2">
          <ul className="space-y-1 rounded-xl border border-line bg-panel p-2 text-sm">
            {players
              .filter((p) => !view.gone.includes(p.seat))
              .sort((a, b) => (view.scores[b.seat] ?? 0) - (view.scores[a.seat] ?? 0))
              .map((p) => (
                <li key={p.seat} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: SEAT_COLORS[p.seat % SEAT_COLORS.length] }} />
                  <span className="min-w-0 flex-1 truncate">
                    {p.name}
                    {p.you && <span className="text-muted"> (you)</span>}
                  </span>
                  {p.seat === drawer && view.phase !== "over" && <span title="Drawing">✏️</span>}
                  {view.guessed.includes(p.seat) && <span title="Guessed it">✅</span>}
                  <span className="font-mono font-semibold tabular-nums">{view.scores[p.seat] ?? 0}</span>
                </li>
              ))}
          </ul>
          <div ref={chatRef} className="flex-1 overflow-y-auto rounded-xl border border-line bg-panel p-2 text-sm" style={{ maxHeight: 220 }} aria-live="polite">
            {view.chat.length === 0 && <p className="text-xs text-muted">Guesses show up here.</p>}
            {view.chat.map((c, i) => (
              <p key={i} className={c.correct ? "font-semibold text-accent" : ""}>
                {c.correct ? (
                  `✓ ${name(c.seat)} guessed the word!`
                ) : (
                  <>
                    <span className="font-medium">{name(c.seat)}:</span> {c.text}
                    {c.close && <span className="ml-1 text-warn">(so close!)</span>}
                  </>
                )}
              </p>
            ))}
          </div>
          <form onSubmit={send} className="flex gap-2">
            <input
              value={guess}
              onChange={(e) => setGuess(e.target.value.slice(0, 60))}
              placeholder={seat === drawer ? "Chat (no spoilers!)" : view.phase === "draw" && !view.word ? "Type your guess…" : "Chat"}
              aria-label="Guess or chat"
              autoComplete="off"
              className="h-10 min-w-0 flex-1 rounded-full border border-line bg-panel px-4 text-sm outline-none focus:border-accent"
            />
            <button type="submit" className="h-10 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover">
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

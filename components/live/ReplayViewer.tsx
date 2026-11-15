"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { scoresAt, type ReplayData, type SnakeFrame } from "@/lib/live/replay";
import type { PlayerView } from "@/lib/live/engine";
import { drawArena, radiusOf, type Snapshot } from "@/lib/live/snake";
import { TEAMS } from "@/lib/live/teams";
import { MODES } from "@/lib/live/types";
import { LiveAvatar } from "./LiveAvatar";
import { setReplayQuiet } from "./fx/sfx";
import { PARTY_MODES, PartyPlay } from "./party";
import { ClassicPlay } from "./PlayLive";
import { card } from "./ui";

const SPEEDS = [1, 2, 4, 8];
const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : `${m}:${String(s % 60).padStart(2, "0")}`;
};

/** The last item at or before time t (items sorted by t). */
function lastAt<T extends { t: number }>(list: T[], t: number): T | null {
  let lo = 0;
  let hi = list.length - 1;
  let best: T | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].t <= t) {
      best = list[mid];
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return best;
}

/** A whole game played back: scores racing, big moments, questions, and Snake Arena's arena. */
export function ReplayViewer({ id }: { id: string }) {
  const [data, setData] = useState<ReplayData | null>(null);
  const [povs, setPovs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(2);

  useEffect(() => {
    fetch(`/api/replays/${id}`)
      .then(async (r) => {
        const b = await r.json().catch(() => null);
        if (!r.ok || !b?.replay) setError(b?.error ?? "couldnt load that replay :(");
        else {
          setData(b.replay);
          setPovs(Array.isArray(b.povs) ? b.povs : []);
        }
      })
      .catch(() => setError("couldnt load that replay :("));
  }, [id]);

  // Play: move time along at the chosen speed.
  useEffect(() => {
    if (!data || !playing) return;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(250, now - last);
      last = now;
      setT((cur) => {
        const next = cur + dt * speed;
        if (next >= data.length) {
          setPlaying(false);
          return data.length;
        }
        return next;
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [data, playing, speed]);

  if (error) return <p className={`${card} text-center text-muted`}>{error}</p>;
  if (!data) return <div className="h-96 animate-pulse rounded-3xl bg-foreground/[.04]" />;
  return <Replay id={id} data={data} povs={povs} t={t} setT={setT} playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed} />;
}

function Replay({ id, data, povs, t, setT, playing, setPlaying, speed, setSpeed }: { id: string; data: ReplayData; povs: string[]; t: number; setT: (t: number) => void; playing: boolean; setPlaying: (p: boolean) => void; speed: number; setSpeed: (s: number) => void }) {
  const def = MODES[data.mode];
  // "Watch as": one player's own screen, played back.
  const [watch, setWatch] = useState<string | null>(null);
  const [pov, setPov] = useState<{ id: string; frames: { t: number; v: PlayerView }[] } | null>(null);
  useEffect(() => {
    if (!watch) return;
    let live = true;
    fetch(`/api/replays/${id}/pov/${watch}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        if (!live || !b?.frames) return;
        const frames = (b.frames as { at: number; v: PlayerView }[]).map((f) => ({ t: f.at - data.startedAt, v: f.v })).sort((x, y) => x.t - y.t);
        setPov({ id: watch, frames });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [watch, id, data.startedAt]);
  // No game sounds while watching someone's screen.
  useEffect(() => {
    setReplayQuiet(true);
    return () => setReplayQuiet(false);
  }, []);
  const watchable = data.players.filter((p) => povs.includes(p.id) || data.snake.length > 0);
  const names = useMemo(() => new Map(data.players.map((p) => [p.id, p])), [data.players]);
  const scores = scoresAt(data.frames, t);
  const board = data.players.map((p) => ({ ...p, score: scores[p.id] ?? 0 })).sort((a, b) => b.score - a.score);
  const top = Math.max(1, ...board.map((p) => p.score));
  const events = data.events.filter((e) => e.t <= t).slice(-8).reverse();
  const q = lastAt(data.questions, t);
  const teams = data.teams
    ? TEAMS.slice(0, data.teams)
        .map((tm, i) => ({ ...tm, i, score: board.filter((p) => p.team === i).reduce((n, p) => n + p.score, 0) }))
        .sort((a, b) => b.score - a.score)
    : null;
  const teamTop = Math.max(1, ...(teams ?? []).map((x) => x.score));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/" className="text-sm text-muted hover:text-foreground">
            ← home
          </Link>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            🎬 {def.icon} {def.name} replay
          </h1>
          <p className="text-sm text-muted">
            {data.setTitle ? `${data.setTitle} · ` : ""}
            {data.host === "solo" ? "solo game" : `hosted by ${data.host}`} · {data.players.length} {data.players.length === 1 ? "playa" : "playas"} · {new Date(data.startedAt).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className={`${card} flex flex-wrap items-center gap-3`}>
        <button type="button" onClick={() => (t >= data.length ? (setT(0), setPlaying(true)) : setPlaying(!playing))} className="h-11 w-11 rounded-full bg-accent text-lg text-on-accent" aria-label={playing ? "Pause" : "Play"}>
          {playing ? "⏸" : t >= data.length ? "↺" : "▶"}
        </button>
        <span className="font-mono text-sm tabular-nums">
          {mmss(t)} / {mmss(data.length)}
        </span>
        <input type="range" min={0} max={data.length} value={Math.round(t)} onChange={(e) => setT(Number(e.target.value))} aria-label="Replay time" className="min-w-40 flex-1 accent-[var(--accent)]" />
        <div className="flex gap-1" role="radiogroup" aria-label="Speed">
          {SPEEDS.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={speed === s} onClick={() => setSpeed(s)} className={`rounded-full px-2.5 py-1 text-sm font-bold ${speed === s ? "bg-accent text-on-accent" : "border border-line hover:bg-accent/10"}`}>
              {s}x
            </button>
          ))}
        </div>
      </div>

      {watchable.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Watch as">
          <span className="mr-1 text-sm font-bold">👀 watch as:</span>
          <button type="button" role="radio" aria-checked={!watch} onClick={() => setWatch(null)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${!watch ? "bg-accent text-on-accent" : "border border-line hover:bg-accent/10"}`}>
            📊 evryone
          </button>
          {watchable.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={watch === p.id}
              onClick={() => setWatch(p.id)}
              className={`flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-sm font-semibold ${watch === p.id ? "bg-accent text-on-accent" : "border border-line hover:bg-accent/10"}`}
            >
              <LiveAvatar avatar={p.avatar} size={22} />
              {p.name}
            </button>
          ))}
        </div>
      )}
      {watch && (
        <section className="flex flex-col gap-2">
          {data.snake.length > 0 ? (
            <SnakeReplay frames={data.snake} t={t} names={names} follow={watch} />
          ) : pov?.id === watch ? (
            <PovScreen frames={pov.frames} t={t} />
          ) : (
            <div className="h-80 animate-pulse rounded-3xl bg-foreground/[.04]" />
          )}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          {data.snake.length > 0 && !watch && <SnakeReplay frames={data.snake} t={t} names={names} />}
          {q && (
            <section className={`${card} flex flex-col gap-2`}>
              <p className="text-xs font-bold text-muted">❓ question {data.questions.indexOf(q) + 1} of {data.questions.length}</p>
              <p className="font-display text-xl font-bold">{q.prompt}</p>
              {q.choices && q.counts ? (
                <ul className="flex flex-col gap-1">
                  {q.choices.map((c, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className={`min-w-0 flex-1 truncate ${q.right.split(" / ").includes(c) ? "font-bold text-emerald-600 dark:text-emerald-400" : ""}`}>
                        {q.right.split(" / ").includes(c) ? "✅ " : ""}
                        {c}
                      </span>
                      <span className="h-2 w-32 overflow-hidden rounded-full bg-foreground/[.07]">
                        <span className="block h-full bg-accent" style={{ width: `${((q.counts![i] ?? 0) / Math.max(1, q.answered)) * 100}%` }} />
                      </span>
                      <span className="w-6 text-right font-mono text-xs">{q.counts![i] ?? 0}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm">
                  ✅ <b>{q.right}</b> · {q.answered} answered
                </p>
              )}
            </section>
          )}
          <section className={`${card} flex flex-col gap-1.5`}>
            <p className="font-display text-xl font-extrabold">📊 scores</p>
            {board.slice(0, 12).map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span className="w-6 text-center font-black">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
                <LiveAvatar avatar={p.avatar} size={22} />
                <span className="w-28 shrink-0 truncate font-semibold">{p.name}</span>
                <span className="h-4 min-w-0 flex-1 overflow-hidden rounded-full bg-foreground/[.06]">
                  <span className="block h-full rounded-full transition-[width] duration-300" style={{ width: `${(p.score / top) * 100}%`, background: p.team !== null && TEAMS[p.team] ? TEAMS[p.team].color : "var(--accent)" }} />
                </span>
                <span className="w-20 text-right font-mono tabular-nums">{def.unit(p.score)}</span>
              </div>
            ))}
            {board.length > 12 && <p className="text-xs text-muted">+{board.length - 12} more</p>}
          </section>
        </div>
        <div className="flex flex-col gap-4">
          {teams && (
            <section className={`${card} flex flex-col gap-1.5`}>
              <p className="font-display text-xl font-extrabold">👥 teams</p>
              {teams.map((tm) => (
                <div key={tm.i} className="flex items-center gap-2 text-sm">
                  <span>{tm.icon}</span>
                  <span className="w-20 truncate font-semibold">{tm.name}</span>
                  <span className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-foreground/[.06]">
                    <span className="block h-full rounded-full transition-[width] duration-300" style={{ width: `${(tm.score / teamTop) * 100}%`, background: tm.color }} />
                  </span>
                  <span className="font-mono text-xs tabular-nums">{tm.score}</span>
                </div>
              ))}
            </section>
          )}
          <section className={`${card} flex flex-col gap-1.5`}>
            <p className="font-display text-xl font-extrabold">⚡ moments</p>
            {events.length === 0 ? (
              <p className="text-sm text-muted">nothin yet…</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {events.map((e, i) => (
                  <li key={`${e.t}-${i}`} className={`flex gap-2 ${i === 0 ? "font-semibold" : "opacity-80"}`}>
                    <span className="w-12 shrink-0 font-mono text-xs text-muted">{mmss(e.t)}</span>
                    <span className="min-w-0 flex-1">{e.text}</span>
                  </li>
                ))}
              </ul>
            )}
            {data.events.length > 0 && (
              <details className="mt-1 text-xs">
                <summary className="cursor-pointer text-muted">all {data.events.length} moments (click one to jump there)</summary>
                <ul className="mt-1 flex max-h-60 flex-col gap-0.5 overflow-y-auto">
                  {data.events.map((e, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => setT(e.t)} className="w-full rounded px-1 text-left hover:bg-accent/10">
                        <span className="font-mono text-muted">{mmss(e.t)}</span> {e.text}
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/** Snake Arena's whole arena at time t, sliding between the recorded frames. */
function SnakeReplay({ frames, t, names, follow }: { frames: SnakeFrame[]; t: number; names: Map<string, { name: string }>; follow?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const a = lastAt(frames, t);
    if (!a) return;
    const b = frames[frames.indexOf(a) + 1];
    const k = b ? Math.min(1, (t - a.t) / Math.max(1, b.t - a.t)) : 0;
    const later = b ? new Map(b.s.map((x) => [x[0], x[4]])) : null;
    const snap: Snapshot = {
      t: a.t,
      f: [],
      e: [],
      s: a.s.map(([id, color, alive, len, body]) => {
        const nb = later?.get(id);
        const blended = nb && nb.length === body.length ? body.map((v, i) => v + (nb[i] - v) * k) : body;
        return [id, names.get(id)?.name ?? "🤖", color, alive, len, len, blended];
      }),
    };
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Watching one player: the camera follows their snake, like on their phone.
    const mine = follow ? snap.s.find((x) => x[0] === follow) : null;
    const cam = mine && mine[6].length >= 2 ? { x: mine[6][0], y: mine[6][1], zoom: Math.max(0.42, 0.95 - radiusOf(mine[4]) / 40) } : null;
    drawArena(ctx, w, h, snap, follow ? cam : null, follow ?? null, performance.now());
  }, [frames, t, names, follow]);
  return <canvas ref={ref} className="aspect-square w-full max-w-2xl self-center rounded-3xl shadow-xl" aria-label="The Snake Arena, replayed" />;
}

/** One player's own screen at time t, shown with the real game screens (nothing clickable). */
function PovScreen({ frames, t }: { frames: { t: number; v: PlayerView }[]; t: number }) {
  const f = lastAt(frames, t) ?? frames[0];
  // Timers count from "now" as if it were then (set when the moment changes).
  const [now, setNow] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
  }, [f]);
  const view = useMemo(() => {
    if (!f || !now) return null;
    // Tower Siege's map lives in the first moment.
    const shift = now - (f.v.serverNow ?? now);
    const v: PlayerView = { ...f.v, serverNow: now, endsAt: f.v.endsAt ? f.v.endsAt + shift : null };
    const firstMap = frames[0]?.v.party?.map;
    if (v.party && !v.party.map && firstMap) v.party = { ...v.party, map: firstMap };
    if (v.party?.rare?.endsAt) v.party = { ...v.party, rare: { ...v.party.rare, endsAt: v.party.rare.endsAt + shift } };
    return v;
  }, [f, frames, now]);
  if (!view) return <p className={`${card} text-center text-muted`}>nothing saved for this player.</p>;
  const noop = async () => null;
  return (
    <div className="pointer-events-none select-none" inert>
      {view.status !== "playing" ? (
        <p className={`${card} text-center text-muted`}>{view.status === "lobby" ? "waiting in the lobby…" : "game over!"}</p>
      ) : PARTY_MODES.includes(view.mode) ? (
        <PartyPlay view={view} busy={false} act={noop} embedded />
      ) : (
        <div className="mx-auto w-full max-w-xl">
          <ClassicPlay view={view} busy={false} skew={0} act={noop} />
        </div>
      )}
    </div>
  );
}

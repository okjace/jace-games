"use client";

import { useEffect, useRef, useState } from "react";
import type { HostView } from "@/lib/live/engine";
import { MAPS, Ops, SHOP, TEAM_INFO, drawOps, type OpsMode, type OpsSnapshot, type ShopItem } from "@/lib/live/ops";
import { openRoomChannel } from "@/lib/realtime/client";
import { card, clock } from "./ui";
import { recordOps } from "./ReplayRecorder";

/**
 * Beacon Rush / Flag Frenzy on the host's big screen: this runs the match
 * for everyone (like Snake Arena), sends phones a snapshot 20 times a
 * second, hears where each phone moved its player, and saves scores every
 * few seconds.
 */
export function OpsHost({ view, secondsLeft, onScores }: { view: HostView; secondsLeft: number | null; onScores: (scores: Record<string, number>) => void }) {
  const mode = view.mode as OpsMode;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ops = useRef<Ops | null>(null);
  const [snap, setSnap] = useState<OpsSnapshot | null>(null);
  const [bots, setBots] = useState(true);
  const scoresRef = useRef(onScores);
  useEffect(() => {
    scoresRef.current = onScores;
  }, [onScores]);

  const roster = view.players.map((p) => `${p.id}:${p.name}`).join("|");
  useEffect(() => {
    ops.current ??= new Ops(mode);
    const o = ops.current;
    const ids = new Set(view.players.map((p) => p.id));
    for (const p of view.players) o.join(p.id, p.name);
    for (const p of [...o.players.values()]) if (!p.bot && !ids.has(p.id)) o.leave(p.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster, mode]);

  useEffect(() => {
    ops.current ??= new Ops(mode);
    const o = ops.current;
    const ch = openRoomChannel(view.topic, null);
    const id = (p: unknown) => (p as { id?: unknown })?.id;
    const offs = [
      ch.on("ops-move", (p) => {
        const m = p as { id?: string; e?: number; x?: number; y?: number; n?: number };
        if (typeof m.id === "string") o.move(m.id, Number(m.e), Number(m.x), Number(m.y), Number(m.n) || 0, Date.now());
      }),
      ch.on("ops-tag", (p) => typeof id(p) === "string" && o.tag(id(p) as string, Date.now())),
      ch.on("ops-dash", (p) => typeof id(p) === "string" && o.dash(id(p) as string, Date.now())),
      ch.on("ops-buy", (p) => {
        const m = p as { id?: string; item?: string };
        if (typeof m.id === "string" && typeof m.item === "string" && m.item in SHOP) o.buy(m.id, m.item as ShopItem, Date.now());
      }),
      ch.on("ops-coins", (p) => {
        const m = p as { playerId?: string; amount?: number };
        if (typeof m.playerId === "string") o.earn(m.playerId, Number(m.amount) || 0);
      }),
    ];
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let latest: OpsSnapshot | null = null;
    let lastTick = performance.now();
    let lastSent = 0;
    let lastSaved = performance.now();
    let lastUi = 0;
    // A timer (not animation frames), so the match keeps going in a background tab.
    const sim = setInterval(() => {
      const now = performance.now();
      let pending = Math.min(1, (now - lastTick) / 1000);
      lastTick = now;
      while (pending > 0) {
        const dt = Math.min(0.04, pending);
        pending -= dt;
        o.step(dt, Date.now());
      }
      latest = o.snapshot(Date.now());
      recordOps(latest);
      if (now - lastSent > 50) {
        lastSent = now;
        ch.send("ops-state", latest);
      }
      if (now - lastUi > 400) {
        lastUi = now;
        setSnap(latest);
      }
      if (now - lastSaved > 3000) {
        lastSaved = now;
        scoresRef.current(o.scores());
      }
    }, 16);
    let raf = 0;
    const frame = (now: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawOps(ctx, w, h, latest, null, null, now);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      clearInterval(sim);
      cancelAnimationFrame(raf);
      offs.forEach((off) => off());
      ch.close();
    };
  }, [view.topic, mode]);

  const m = MAPS[mode];
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="relative">
        <canvas ref={canvasRef} className="w-full rounded-3xl shadow-xl" style={{ aspectRatio: `${m.cols} / ${m.rows}` }} aria-label={mode === "beacon" ? "The Beacon Rush map" : "The Flag Frenzy map"} />
        <p className={`absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 font-mono text-2xl font-black text-white ${secondsLeft !== null && secondsLeft <= 10 ? "text-red-300" : ""}`}>{clock(secondsLeft)}</p>
        {snap && <Banner snap={snap} big />}
        {snap && snap.events.length > 0 && (
          <ul className="absolute bottom-3 left-3 flex flex-col gap-1 text-sm font-bold text-white">
            {snap.events.slice(0, 3).map((e, i) => (
              <li key={`${e}-${i}`} className="w-fit rounded-full bg-black/55 px-3 py-0.5" style={{ opacity: 1 - i * 0.25 }}>
                {e}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={`${card} flex flex-col gap-3`}>
        {snap && <Score snap={snap} />}
        {snap &&
          ([0, 1] as const).map((team) => (
            <div key={team} className="flex flex-col gap-1">
              <p className="font-bold" style={{ color: TEAM_INFO[team].color }}>
                {TEAM_INFO[team].icon} {TEAM_INFO[team].name}
                {mode === "beacon" && <span className="ml-1 text-xs text-muted">{snap.attack === team ? "attacking" : "defending"}</span>}
              </p>
              {snap.p
                .filter((p) => p[2] === team)
                .map((p) => (
                  <p key={p[0]} className={`flex items-center gap-1 truncate text-sm ${p[0].startsWith("bot-") ? "text-muted" : "font-semibold"}`}>
                    {p[5] ? "❄️" : p[7] === 1 ? "🔦" : p[7] === 2 ? "🚩" : "•"} {p[1]}
                  </p>
                ))}
            </div>
          ))}
        <button
          type="button"
          onClick={() => {
            const on = !bots;
            setBots(on);
            if (ops.current) ops.current.botsOn = on;
          }}
          aria-pressed={bots}
          className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:bg-accent/10"
        >
          🤖 bots fill teams to 3: {bots ? "on" : "off"}
        </button>
        <p className="mt-auto text-xs text-muted">
          {mode === "beacon" ? "freeze tag only, no weapons! plant the beacon or freeze the whole other team." : "bring their flag home while urs is safe. frozen players thaw in 5 secs."} right ansers = shop coins.
        </p>
      </div>
    </div>
  );
}

/** Rounds or captures, team vs team. */
export function Score({ snap }: { snap: OpsSnapshot }) {
  return (
    <div className="flex items-center justify-center gap-3 font-display text-3xl font-black">
      <span style={{ color: TEAM_INFO[0].color }}>{snap.wins[0]}</span>
      <span className="text-base text-muted">{snap.mode === "beacon" ? `round ${snap.round}` : "captures"}</span>
      <span style={{ color: TEAM_INFO[1].color }}>{snap.wins[1]}</span>
    </div>
  );
}

/** Big words over the map: the buy phase, a planted beacon, the winner. */
export function Banner({ snap, big = false, at }: { snap: OpsSnapshot; big?: boolean; at?: number }) {
  const now = at ?? snap.t;
  const secs = (t: number) => Math.max(0, Math.ceil((t - now) / 1000));
  let text: string | null = null;
  if (snap.phase === "over" && snap.winner !== null) text = `🏆 ${TEAM_INFO[snap.winner].icon} ${TEAM_INFO[snap.winner].name} wins!!`;
  else if (snap.mode === "beacon" && snap.phase === "buy") text = `🛒 shop time! go in ${secs(snap.phaseEnds)}`;
  else if (snap.mode === "beacon" && snap.beacon?.planted) text = `🔦 beacon at ${snap.beacon.site}! ${secs(snap.beacon.endsAt)}s`;
  else if (snap.mode === "beacon" && snap.phase === "play") text = `⏱️ ${secs(snap.phaseEnds)}s`;
  if (!text) return null;
  return <p className={`pointer-events-none absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 font-black text-white ${big ? "text-2xl" : "text-sm"}`}>{text}</p>;
}

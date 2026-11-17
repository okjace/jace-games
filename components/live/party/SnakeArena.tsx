"use client";

import { useEffect, useRef, useState } from "react";
import { ARENA, Arena, BASE_SPEED, BOOST_SPEED, SPACING, START_LEN, TURN_RATE, advance, blendSnapshots, drawArena, radiusOf, type Snapshot } from "@/lib/live/snake";
import { openRoomChannel } from "@/lib/realtime/client";
import { useJuice } from "../fx/Juice";
import { sfx } from "../fx/sfx";
import { recordSnake } from "../ReplayRecorder";
import type { StageProps } from "./index";

/**
 * Snake Arena on a player's phone: a camera that follows your snake, steer
 * by pointing (or dragging), hold to boost. In a hosted game the host's big
 * screen runs the arena; this moves your own snake right away and tells the
 * host where it went (the host decides crashes n food); in
 * a solo game this device runs the arena itself, with bots.
 */
export function SnakeArena({ view, act, earn }: StageProps) {
  const juice = useJuice();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snapRef = useRef<Snapshot | null>(null);
  const [bots, setBots] = useState(true);
  const local = useRef<Arena | null>(null);
  const input = useRef({ a: 0, b: false });
  const [me, setMe] = useState<{ len: number; best: number; alive: boolean; rank: number; inArena: boolean }>({ len: 0, best: 0, alive: true, rank: 0, inArena: false });
  const solo = !!view.solo;
  const myId = view.me.id;
  // act changes on every render; the arena loop shouldn't restart because of it.
  const actRef = useRef(act);
  useEffect(() => {
    actRef.current = act;
  }, [act]);

  // Right answers: grow (the server tells the host's arena; a solo arena hears it here).
  const fedKey = view.last?.kind === "feed" ? `${view.me.answered}` : "";
  const seenFed = useRef(fedKey);
  useEffect(() => {
    if (!fedKey || fedKey === seenFed.current) return;
    seenFed.current = fedKey;
    const amount = Number(view.last?.amount) || 10;
    if (solo) local.current?.feed(myId, amount);
    sfx.levelUp();
    juice.pop(`+${amount} 🐍 longer!!`, "#a3e635");
  }, [fedKey, solo, myId, view.last, juice]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let ch: ReturnType<typeof openRoomChannel> | null = null;
    let off: (() => void) | null = null;
    // Online: the host's snapshots, kept for a moment so they can be played back smoothly
    // a little behind (late or bunched-up ones don't make things freeze n jump).
    const buf: Snapshot[] = [];
    let offset = NaN;
    if (solo) {
      local.current ??= new Arena();
      local.current.join(myId, view.me.name);
    } else {
      ch = openRoomChannel(view.topic, null);
      off = ch.on("snake-state", (p) => {
        const snap = p as Snapshot;
        if (!snap || typeof snap.t !== "number") return;
        // How far the host's clock is from ours (+ the trip), taking the quickest trips.
        const o = Date.now() - snap.t;
        offset = Number.isNaN(offset) || o < offset ? o : offset + (o - offset) * 0.02;
        if (buf.some((x) => x.t === snap.t)) return;
        buf.push(snap);
        buf.sort((x, y) => x.t - y.t);
        if (buf.length > 12) buf.splice(0, buf.length - 12);
        // Late ones (they can arrive out of order) never replace a newer one.
        if (!snapRef.current || snap.t >= snapRef.current.t) snapRef.current = snap;
      });
    }
    // Ur own snake moves right here (no waiting on the host); the host checks crashes n food.
    let mine: { life: number; pts: { x: number; y: number }[]; angle: number; out: number[]; sentAt: number } | null = null;
    // Moves are numbered so the host can ignore late ones.
    let seq = 0;
    let steerAt = 0;
    let raf = 0;
    let last = performance.now();
    let lastHud = 0;
    let lastReport = performance.now();
    const cam = { x: 1200, y: 1200, zoom: 0.8 };
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const inp = input.current;
      let snap: Snapshot | null;
      if (solo && local.current) {
        local.current.steer(myId, inp.a, inp.b);
        local.current.step(dt, Date.now());
        snapRef.current = local.current.snapshot(Date.now());
        recordSnake(snapRef.current);
        if (now - lastReport > 5000) {
          lastReport = now;
          const sn = local.current.snakes.get(myId);
          if (sn) void actRef.current({ action: "snake-score", score: sn.best });
        }
        snap = snapRef.current;
      } else {
        // Other snakes: ~110ms behind the host, sliding between the two snapshots around then.
        const at = Date.now() - offset - 110;
        let i = buf.length - 1;
        while (i > 0 && buf[i - 1].t > at) i--;
        const b2 = buf[i] ?? null;
        const a2 = i > 0 ? buf[i - 1] : null;
        snap = !b2 ? null : !a2 || at >= b2.t ? b2 : blendSnapshots(a2, b2, (at - a2.t) / Math.max(1, b2.t - a2.t));
        // Me: from the newest snapshot (alive? how long? which life?), moved locally.
        const latest = snapRef.current;
        const hostMe = latest?.s.find((x) => x[0] === myId);
        // (A host screen on an older version doesn't say which life u're on: then it steers u like before.)
        const predict = typeof hostMe?.[8] === "number";
        if (!hostMe || !hostMe[3] || !predict) {
          mine = null;
          if (ch && hostMe?.[3] && now - steerAt > 70) {
            steerAt = now;
            ch.send("snake-input", { id: myId, a: inp.a, b: inp.b });
          }
        } else if (!mine || mine.life !== hostMe[8]) {
          // Start from where the host has u, filled back in to full detail.
          const body = hostMe[6];
          const pts: { x: number; y: number }[] = [];
          for (let k = 0; k + 1 < body.length; k += 2) {
            const p = { x: body[k], y: body[k + 1] };
            const prev = pts[pts.length - 1];
            if (prev) {
              const d = Math.hypot(p.x - prev.x, p.y - prev.y);
              for (let j = 1; j < Math.floor(d / SPACING); j++) pts.push({ x: prev.x + ((p.x - prev.x) * j * SPACING) / d, y: prev.y + ((p.y - prev.y) * j * SPACING) / d });
            }
            pts.push(p);
          }
          mine = pts.length >= 2 ? { life: hostMe[8] ?? 0, pts, angle: Math.atan2(pts[0].y - pts[1].y, pts[0].x - pts[1].x), out: [], sentAt: now } : null;
        }
        if (mine && hostMe) {
          const len = hostMe[4];
          let d = inp.a - mine.angle;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          const turn = TURN_RATE * dt * (inp.b ? 0.8 : 1);
          mine.angle += Math.max(-turn, Math.min(turn, d));
          const boosting = inp.b && ((hostMe[7] ?? 0) > 0 || len > START_LEN + 4);
          const h = mine.pts[0];
          const nx = Math.max(-5, Math.min(ARENA + 5, h.x + Math.cos(mine.angle) * (boosting ? BOOST_SPEED : BASE_SPEED) * dt));
          const ny = Math.max(-5, Math.min(ARENA + 5, h.y + Math.sin(mine.angle) * (boosting ? BOOST_SPEED : BASE_SPEED) * dt));
          const before = mine.pts.length;
          advance(mine.pts, nx, ny);
          if (mine.pts.length > before) mine.out.push(Math.round(mine.pts[1].x * 10) / 10, Math.round(mine.pts[1].y * 10) / 10);
          while (mine.pts.length > Math.max(2, Math.round(len))) mine.pts.pop();
          // Tell the host where u went, 12 times a second.
          if (ch && now - mine.sentAt > 80) {
            ch.send("snake-move", { id: myId, l: mine.life, n: ++seq, p: [...mine.out, Math.round(nx * 10) / 10, Math.round(ny * 10) / 10], b: inp.b });
            mine.out = [];
            mine.sentAt = now;
          }
          // Draw my snake where I see it, not where the host last heard.
          const body: number[] = [];
          const stride = Math.max(2, Math.ceil(mine.pts.length / 80));
          for (let k = 0; k < mine.pts.length; k += stride) body.push(mine.pts[k].x, mine.pts[k].y);
          if (snap) snap = { ...snap, s: snap.s.map((x) => (x[0] === myId ? ([x[0], x[1], x[2], 1, hostMe[4], hostMe[5], body, hostMe[7], hostMe[8]] as Snapshot["s"][number]) : x)) };
        }
      }
      const meNow = snap?.s.find((x) => x[0] === myId);
      if (meNow && meNow[3] && meNow[6].length >= 2) {
        // The camera glides after your head and pulls back as you grow.
        const k = Math.min(1, dt * (solo ? 8 : 14));
        cam.x += (meNow[6][0] - cam.x) * k;
        cam.y += (meNow[6][1] - cam.y) * k;
        const want = Math.max(0.42, 0.95 - radiusOf(meNow[4]) / 40);
        cam.zoom += (want - cam.zoom) * Math.min(1, dt * 2);
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawArena(ctx, w, h, snap, cam, myId, now);
      if (now - lastHud > 300) {
        lastHud = now;
        const sorted = snap ? [...snap.s].sort((x, y) => y[4] - x[4]) : [];
        setMe({ len: meNow?.[4] ?? 0, best: meNow?.[5] ?? 0, alive: !!meNow?.[3], rank: Math.max(0, sorted.findIndex((x) => x[0] === myId)) + 1, inArena: !!meNow });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      off?.();
      ch?.close();
    };
  }, [solo, myId, view.topic, view.me.name]);

  // Point (or drag) to steer: the angle from the middle of the screen to the pointer.
  const aim = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    input.current.a = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
  };
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === " ") {
        input.current.b = true;
        e.preventDefault();
      }
      if (e.key === "ArrowLeft") input.current.a -= 0.35;
      if (e.key === "ArrowRight") input.current.a += 0.35;
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === " ") input.current.b = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 text-sm font-bold">
        <span className="rounded-full bg-black/30 px-3 py-1.5">🐍 {me.len} long</span>
        <span className="rounded-full bg-black/30 px-3 py-1.5">🏆 best {me.best}</span>
        <span className="rounded-full bg-black/30 px-3 py-1.5">#{me.rank || "–"}</span>
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          onPointerMove={aim}
          onPointerDown={(e) => {
            aim(e);
            if (e.pointerType === "mouse") input.current.b = true;
          }}
          onPointerUp={() => (input.current.b = false)}
          onPointerLeave={() => (input.current.b = false)}
          className="touch-game aspect-square w-full rounded-3xl bg-slate-900 shadow-xl"
          aria-label="Snake Arena. Point or drag to steer, hold the mouse or the boost button to go fast."
        />
        {!me.inArena && !solo && (
          <p className="absolute inset-0 flex items-center justify-center rounded-3xl bg-black/50 p-6 text-center font-bold">
            waitin for the big screen… (the host needs the game open) 📺
          </p>
        )}
        {me.inArena && !me.alive && (
          <p className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-black/50 text-center">
            <span className="text-5xl">💥</span>
            <span className="text-xl font-black">bonk!! respawning…</span>
          </p>
        )}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            input.current.b = true;
          }}
          onPointerUp={() => (input.current.b = false)}
          onPointerLeave={() => (input.current.b = false)}
          className="touch-game absolute bottom-3 right-3 h-16 w-16 select-none rounded-full bg-amber-400 text-sm font-black text-black shadow-[0_5px_0_rgba(0,0,0,0.35)] active:translate-y-1 active:shadow-none"
        >
          ⚡ BOOST
        </button>
      </div>
      {solo && (
        <button
          type="button"
          onClick={() => {
            const on = !bots;
            setBots(on);
            if (local.current) local.current.botsOn = on;
          }}
          aria-pressed={bots}
          className="self-center rounded-full bg-black/30 px-4 py-1.5 text-sm font-bold"
        >
          🤖 bots: {bots ? "on" : "off"}
        </button>
      )}
      <p className="text-center text-xs font-semibold text-white/80">point or drag to steer · hold to boost (costs length) · bonk others into ur body!</p>
      <p className="text-center text-sm font-black">answer right = +10 length (more on a streak) 👇</p>
      {earn}
    </div>
  );
}

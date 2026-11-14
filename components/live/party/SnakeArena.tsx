"use client";

import { useEffect, useRef, useState } from "react";
import { Arena, drawArena, radiusOf, type Snapshot } from "@/lib/live/snake";
import { openRoomChannel } from "@/lib/realtime/client";
import { useJuice } from "../fx/Juice";
import { sfx } from "../fx/sfx";
import type { StageProps } from "./index";

/**
 * Snake Arena on a player's phone: a camera that follows your snake, steer
 * by pointing (or dragging), hold to boost. In a hosted game the host's big
 * screen runs the arena and this just shows it and sends your steering; in
 * a solo game this device runs the arena itself, with bots.
 */
export function SnakeArena({ view, act, earn }: StageProps) {
  const juice = useJuice();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snapRef = useRef<Snapshot | null>(null);
  const local = useRef<Arena | null>(null);
  const input = useRef({ a: 0, b: false, sentA: NaN, sentB: false, sentAt: 0 });
  const [me, setMe] = useState<{ len: number; best: number; alive: boolean; rank: number; inArena: boolean }>({ len: 0, best: 0, alive: true, rank: 0, inArena: false });
  const solo = !!view.solo;
  const myId = view.me.id;

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
    if (solo) {
      local.current ??= new Arena();
      local.current.join(myId, view.me.name);
    } else {
      ch = openRoomChannel(view.topic, null);
      off = ch.on("snake-state", (p) => {
        snapRef.current = p as Snapshot;
      });
    }
    let raf = 0;
    let last = performance.now();
    let lastHud = 0;
    let lastReport = performance.now();
    const cam = { x: 1200, y: 1200, zoom: 0.8 };
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const inp = input.current;
      if (solo && local.current) {
        local.current.steer(myId, inp.a, inp.b);
        local.current.step(dt, Date.now());
        snapRef.current = local.current.snapshot(Date.now());
        if (now - lastReport > 5000) {
          lastReport = now;
          const s = local.current.snakes.get(myId);
          if (s) void act({ action: "snake-score", score: s.best });
        }
      } else if (ch && (Math.abs(inp.a - inp.sentA) > 0.05 || inp.b !== inp.sentB || now - inp.sentAt > 600) && now - inp.sentAt > 70) {
        // Steering goes to the host about 10 times a second (only when it changes, plus a heartbeat).
        ch.send("snake-input", { id: myId, a: inp.a, b: inp.b });
        inp.sentA = inp.a;
        inp.sentB = inp.b;
        inp.sentAt = now;
      }
      const snap = snapRef.current;
      const mine = snap?.s.find((s) => s[0] === myId);
      if (mine && mine[3] && mine[6].length >= 2) {
        // The camera glides after your head and pulls back as you grow.
        const k = Math.min(1, dt * 8);
        cam.x += (mine[6][0] - cam.x) * k;
        cam.y += (mine[6][1] - cam.y) * k;
        const want = Math.max(0.42, 0.95 - radiusOf(mine[4]) / 40);
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
        const sorted = snap ? [...snap.s].sort((a, b) => b[4] - a[4]) : [];
        setMe({ len: mine?.[4] ?? 0, best: mine?.[5] ?? 0, alive: !!mine?.[3], rank: Math.max(0, sorted.findIndex((s) => s[0] === myId)) + 1, inArena: !!mine });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      off?.();
      ch?.close();
    };
  }, [solo, myId, view.topic, view.me.name, act]);

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
      <p className="text-center text-xs font-semibold text-white/80">point or drag to steer · hold to boost (costs length) · bonk others into ur body!</p>
      <p className="text-center text-sm font-black">answer right = +10 length (more on a streak) 👇</p>
      {earn}
    </div>
  );
}

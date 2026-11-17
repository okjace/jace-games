"use client";

import { useEffect, useRef, useState } from "react";
import { MAPS, Ops, SHOP, TEAM_INFO, drawOps, slide, type OpsMode, type OpsSnapshot, type ShopItem } from "@/lib/live/ops";
import { openRoomChannel } from "@/lib/realtime/client";
import { useJuice } from "../fx/Juice";
import { sfx } from "../fx/sfx";
import { Banner, Score } from "../OpsHost";
import type { StageProps } from "./index";

const SPEED = 175;

/** Slides everyone between two snapshots (players who respawned jump). */
function blend(a: OpsSnapshot, b: OpsSnapshot, k: number): OpsSnapshot {
  const old = new Map(a.p.map((p) => [p[0], p]));
  return {
    ...b,
    p: b.p.map((p) => {
      const o = old.get(p[0]);
      if (!o || o[9] !== p[9]) return p;
      const q = [...p] as OpsSnapshot["p"][number];
      q[3] = o[3] + (p[3] - o[3]) * k;
      q[4] = o[4] + (p[4] - o[4]) * k;
      return q;
    }),
  };
}

/**
 * Beacon Rush / Flag Frenzy on a player's phone: a camera on ur player, a
 * thumb stick (or WASD / arrows), a freeze button, dashes and the shop. In a
 * hosted game the big screen runs the match and this moves ur player right
 * away, telling the host where u went; in a solo game this runs it, with bots.
 */
export function OpsPlay({ view, act, earn }: StageProps) {
  const mode = view.mode as OpsMode;
  const juice = useJuice();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const local = useRef<Ops | null>(null);
  const chRef = useRef<ReturnType<typeof openRoomChannel> | null>(null);
  const input = useRef({ x: 0, y: 0, keys: new Set<string>() });
  const dashAt = useRef(0);
  const [stick, setStick] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const [hud, setHud] = useState<{ snap: OpsSnapshot | null; now: number }>({ snap: null, now: 0 });
  const solo = !!view.solo;
  const myId = view.me.id;

  // Right answers: shop coins (the server tells the host; a solo game hears it here).
  const coinKey = view.last?.kind === "ops-coins" ? `${view.me.answered}` : "";
  const seen = useRef(coinKey);
  useEffect(() => {
    if (!coinKey || coinKey === seen.current) return;
    seen.current = coinKey;
    const amount = Number(view.last?.amount) || 10;
    if (solo) local.current?.earn(myId, amount);
    sfx.coin();
    juice.pop(`+${amount} 🪙`, "#fde047");
  }, [coinKey, solo, myId, view.last, juice]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const map = MAPS[mode];
    const buf: OpsSnapshot[] = [];
    let offset = NaN;
    let latest: OpsSnapshot | null = null;
    let off: (() => void) | null = null;
    if (solo) {
      local.current ??= new Ops(mode);
      local.current.join(myId, view.me.name, 0);
    } else {
      const ch = openRoomChannel(view.topic, null);
      chRef.current = ch;
      off = ch.on("ops-state", (p) => {
        const snap = p as OpsSnapshot;
        if (!snap || typeof snap.t !== "number" || !Array.isArray(snap.p)) return;
        const o = Date.now() - snap.t;
        offset = Number.isNaN(offset) || o < offset ? o : offset + (o - offset) * 0.02;
        if (buf.some((x) => x.t === snap.t)) return;
        buf.push(snap);
        buf.sort((x, y) => x.t - y.t);
        if (buf.length > 12) buf.splice(0, buf.length - 12);
        if (!latest || snap.t >= latest.t) latest = snap;
      });
    }
    // Me, moved right here; the host checks walls n speed.
    let mine: { x: number; y: number; epoch: number; sentAt: number } | null = null;
    let seq = 0;
    let raf = 0;
    let last = performance.now();
    let lastHud = 0;
    let lastReport = performance.now();
    const cam = { x: 640, y: 360, zoom: 1 };
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // Where I want to go: the stick, or keys.
      const k = input.current.keys;
      let ix = input.current.x + (k.has("arrowright") || k.has("d") ? 1 : 0) - (k.has("arrowleft") || k.has("a") ? 1 : 0);
      let iy = input.current.y + (k.has("arrowdown") || k.has("s") ? 1 : 0) - (k.has("arrowup") || k.has("w") ? 1 : 0);
      const len = Math.hypot(ix, iy);
      if (len > 1) {
        ix /= len;
        iy /= len;
      }
      let snap: OpsSnapshot | null;
      if (solo && local.current) {
        const o = local.current;
        const me = o.players.get(myId);
        if (me && !me.frozen && o.phase === "play") slide(map, me, ix * o.speedOf(me, Date.now()) * dt, iy * o.speedOf(me, Date.now()) * dt);
        o.step(dt, Date.now());
        snap = o.snapshot(Date.now());
        if (now - lastReport > 5000) {
          lastReport = now;
          void act({ action: "snake-score", score: o.scores()[myId] ?? 0 });
        }
      } else {
        // Everyone else: ~110ms behind the host, sliding between snapshots.
        const at = Date.now() - offset - 110;
        let i = buf.length - 1;
        while (i > 0 && buf[i - 1].t > at) i--;
        const b2 = buf[i] ?? null;
        const a2 = i > 0 ? buf[i - 1] : null;
        snap = !b2 ? null : !a2 || at >= b2.t ? b2 : blend(a2, b2, (at - a2.t) / Math.max(1, b2.t - a2.t));
        const hostMe = latest?.p.find((x) => x[0] === myId);
        if (!hostMe || hostMe[5] || latest?.phase !== "play") {
          mine = hostMe ? { x: hostMe[3], y: hostMe[4], epoch: hostMe[9], sentAt: now } : null;
        } else {
          if (!mine || mine.epoch !== hostMe[9] || Math.hypot(mine.x - hostMe[3], mine.y - hostMe[4]) > 110) mine = { x: hostMe[3], y: hostMe[4], epoch: hostMe[9], sentAt: now };
          const speed = SPEED * (hostMe[10] ? 1.25 : 1) * (hostMe[11] || now < dashAt.current ? 2.1 : 1);
          slide(map, mine, ix * speed * dt, iy * speed * dt);
          if (chRef.current && now - mine.sentAt > 80) {
            mine.sentAt = now;
            chRef.current.send("ops-move", { id: myId, e: mine.epoch, x: Math.round(mine.x * 10) / 10, y: Math.round(mine.y * 10) / 10, n: ++seq });
          }
        }
        if (snap && mine) {
          const m = mine;
          snap = { ...snap, p: snap.p.map((x) => (x[0] === myId ? ([x[0], x[1], x[2], m.x, m.y, ...x.slice(5)] as OpsSnapshot["p"][number]) : x)) };
        }
      }
      const meNow = snap?.p.find((x) => x[0] === myId);
      if (meNow) {
        const kk = Math.min(1, dt * 10);
        cam.x += (meNow[3] - cam.x) * kk;
        cam.y += (meNow[4] - cam.y) * kk;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      cam.zoom = Math.max(w / 720, h / 520);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawOps(ctx, w, h, snap, meNow ? cam : null, myId, now);
      if (now - lastHud > 250) {
        lastHud = now;
        setHud({ snap, now: solo ? Date.now() : Date.now() - (Number.isNaN(offset) ? 0 : offset) });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const keyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
        if ((e.target as HTMLElement)?.tagName === "INPUT") return;
        input.current.keys.add(key);
        e.preventDefault();
      }
    };
    const keyUp = (e: KeyboardEvent) => input.current.keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    return () => {
      cancelAnimationFrame(raf);
      off?.();
      chRef.current?.close();
      chRef.current = null;
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, [mode, solo, myId, view.topic, view.me.name, act]);

  const send = (event: string, extra: Record<string, unknown> = {}) => {
    if (solo) {
      const o = local.current;
      if (!o) return;
      if (event === "ops-tag") o.tag(myId, Date.now());
      if (event === "ops-dash") o.dash(myId, Date.now());
      if (event === "ops-buy") return o.buy(myId, extra.item as ShopItem, Date.now());
      return true;
    }
    chRef.current?.send(event, { id: myId, ...extra });
    return true;
  };

  const snap = hud.snap;
  const me = snap?.p.find((x) => x[0] === myId);
  const [coins, dashes] = snap?.c[myId] ?? [0, 0];
  const team = me ? TEAM_INFO[me[2]] : null;

  // The thumb stick: press anywhere on the map and drag.
  const stickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!stick) return;
    const dx = e.clientX - stick.x;
    const dy = e.clientY - stick.y;
    const d = Math.hypot(dx, dy);
    const k = d > 50 ? 50 / d : 1;
    input.current.x = (dx * k) / 50;
    input.current.y = (dy * k) / 50;
    setStick({ ...stick, dx: dx * k, dy: dy * k });
  };
  const stickEnd = () => {
    input.current.x = 0;
    input.current.y = 0;
    setStick(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold">
        {team && (
          <span className="rounded-full px-3 py-1.5 text-black" style={{ background: team.color }}>
            {team.icon} team {team.name}
            {mode === "beacon" && snap ? (snap.attack === me![2] ? " · attack" : " · defend") : ""}
          </span>
        )}
        <span className="rounded-full bg-black/30 px-3 py-1.5">🪙 {coins}</span>
        {snap && (
          <span className="rounded-full bg-black/30 px-3 py-1.5">
            <Score snap={snap} />
          </span>
        )}
      </div>
      <div
        className="touch-game relative select-none"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          setStick({ x: e.clientX, y: e.clientY, dx: 0, dy: 0 });
        }}
        onPointerMove={stickMove}
        onPointerUp={stickEnd}
        onPointerCancel={stickEnd}
      >
        <canvas ref={canvasRef} className="aspect-[4/3] w-full rounded-3xl bg-slate-900 shadow-xl" aria-label={`${mode === "beacon" ? "Beacon Rush" : "Flag Frenzy"}. Drag on the map or use the arrow keys to move.`} />
        {snap && <Banner snap={snap} at={hud.now} />}
        {stick && (
          <span className="pointer-events-none fixed z-10 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/50 bg-white/10" style={{ left: stick.x, top: stick.y }}>
            <span className="absolute left-1/2 top-1/2 h-10 w-10 rounded-full bg-white/70" style={{ transform: `translate(calc(-50% + ${stick.dx}px), calc(-50% + ${stick.dy}px))` }} />
          </span>
        )}
        {!me && !solo && <p className="absolute inset-0 flex items-center justify-center rounded-3xl bg-black/50 p-6 text-center font-bold">waitin for the big screen… (the host needs the game open) 📺</p>}
        {me?.[5] === 1 && (
          <p className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-xl font-black drop-shadow">
            ❄️ frozen! {mode === "beacon" ? "a teammate can thaw u" : "thawing soon…"}
          </p>
        )}
        <div className="absolute bottom-3 right-3 flex flex-col items-end gap-2">
          <button
            type="button"
            disabled={!dashes}
            onPointerDown={(e) => {
              e.preventDefault();
              if (!dashes) return;
              dashAt.current = performance.now() + 1200;
              send("ops-dash");
              sfx.whoosh();
            }}
            className="h-12 w-12 rounded-full bg-sky-400 text-xs font-black text-black shadow-[0_4px_0_rgba(0,0,0,0.35)] active:translate-y-1 active:shadow-none disabled:opacity-40"
          >
            💨{dashes}
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              send("ops-tag");
              sfx.tap();
            }}
            className="h-16 w-16 rounded-full bg-cyan-200 text-sm font-black text-black shadow-[0_5px_0_rgba(0,0,0,0.35)] active:translate-y-1 active:shadow-none"
          >
            ❄️ TAG
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(SHOP) as ShopItem[]).map((item) => {
          const it = SHOP[item];
          return (
            <button
              key={item}
              type="button"
              disabled={coins < it.cost}
              title={it.desc}
              onClick={() => {
                if (send("ops-buy", { item }) === false) return;
                sfx.buy();
                juice.pop(`${it.icon} ${it.name}!`, "#a5f3fc");
              }}
              className="flex flex-col items-center rounded-2xl bg-black/30 px-2 py-2 text-xs font-bold disabled:opacity-40"
            >
              <span className="text-2xl">{it.icon}</span>
              {it.name}
              <span className="font-mono">🪙 {it.cost}</span>
            </button>
          );
        })}
      </div>
      <p className="text-center text-xs font-semibold text-white/80">
        drag on the map (or WASD / arrows) to move · ❄️ TAG freezes someone close · stand by a frozen teammate to thaw them
        {mode === "beacon" ? " · carry the 🔦 to A or B n stay 3 secs to plant" : " · grab their flag, run it home"}
      </p>
      <p className="text-center text-sm font-black">answer right = shop coins 👇</p>
      {earn}
      {snap && (
        <ul className="flex flex-col gap-1 text-xs font-semibold text-white/80">
          {snap.events.slice(0, 3).map((e, i) => (
            <li key={`${e}-${i}`}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sfx } from "../fx/sfx";
import { Tabs, useReport, useSaved, type PartyProps } from "./shared";

/**
 * Sled Dash: ride a sled down a snowy hill. Steer around trees, rocks and
 * snowmen, grab gifts for points and snowflakes for a burst of speed. It
 * keeps getting faster. Right answers earn coins: a run costs 10, a shield
 * (survives one crash, unused ones carry over) costs 15. Your best run is your score: meters, plus
 * 25 for every gift.
 */

export const RUN_COST = 10;
export const SHIELD_COST = 15;
const MAX_SHIELDS = 2;
const W = 360;
const H = 540;
const SLED_Y = 150;

type Thing = { x: number; y: number; kind: "tree" | "rock" | "snowman" | "gift" | "flake"; r: number; hit?: boolean };
const LOOK: Record<Thing["kind"], string> = { tree: "🌲", rock: "🪨", snowman: "⛄", gift: "🎁", flake: "❄️" };
type Saved = { used: number; best: number; runs: number; shields: number };
type Run = { x: number; target: number; speed: number; dist: number; gifts: number; things: Thing[]; boostUntil: number; safeUntil: number; shields: number; over: boolean; t: number; trail: { x: number; y: number; life: number }[]; spawnIn: number };

export function SledDash({ view, act, earn }: PartyProps) {
  const [tab, setTab] = useState<"play" | "earn">("earn");
  const [saved, save] = useSaved<Saved>(view.code, "sled", () => ({ used: 0, best: 0, runs: 0, shields: 0 }));
  const coins = Math.max(0, (view.party.bank ?? 0) - saved.used);
  useReport(act, saved.best);
  const [run, setRun] = useState<{ score: number; dist: number; gifts: number; over: boolean } | null>(null);
  // Bumps once per run, so the ride loop starts once (not on every score update).
  const [runId, setRunId] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef<Run | null>(null);
  const keys = useRef({ left: false, right: false });

  const start = () => {
    if (coins < RUN_COST) return;
    sfx.tap();
    // Shields stay saved until a crash uses one (unused ones carry over to the next run).
    save((s) => ({ ...s, used: s.used + RUN_COST, runs: s.runs + 1 }));
    live.current = { x: W / 2, target: W / 2, speed: 190, dist: 0, gifts: 0, things: [], boostUntil: 0, safeUntil: 0, shields: saved.shields, over: false, t: 0, trail: [], spawnIn: 0.4 };
    setRun({ score: 0, dist: 0, gifts: 0, over: false });
    setRunId((n) => n + 1);
  };
  const buyShield = () => {
    if (coins < SHIELD_COST || saved.shields >= MAX_SHIELDS) return;
    sfx.buy();
    save((s) => ({ ...s, used: s.used + SHIELD_COST, shields: s.shields + 1 }));
  };

  const finish = useCallback(
    (r: Run) => {
      const score = Math.floor(r.dist / 10) + r.gifts * 25;
      setRun({ score, dist: Math.floor(r.dist / 10), gifts: r.gifts, over: true });
      save((s) => ({ ...s, best: Math.max(s.best, score) }));
    },
    [save],
  );

  // The ride itself.
  useEffect(() => {
    if (!runId || !live.current || live.current.over || tab !== "play") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let last = performance.now();
    let hud = 0;
    const frame = (now: number) => {
      const r = live.current;
      if (!r || r.over) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      r.t += dt;
      // Faster and faster (a snowflake gives a burst).
      r.speed = Math.min(720, r.speed + 7 * dt);
      const speed = r.speed * (r.t < r.boostUntil ? 1.5 : 1);
      r.dist += speed * dt;
      // Steering: keys nudge the target, pointer sets it.
      if (keys.current.left) r.target -= 380 * dt;
      if (keys.current.right) r.target += 380 * dt;
      r.target = Math.max(24, Math.min(W - 24, r.target));
      r.x += (r.target - r.x) * Math.min(1, dt * 9);
      // New things come up the hill, more of them the further you go.
      r.spawnIn -= dt * (speed / 260);
      if (r.spawnIn <= 0) {
        const roll = Math.random();
        const kind: Thing["kind"] = roll < 0.42 ? "tree" : roll < 0.62 ? "rock" : roll < 0.74 ? "snowman" : roll < 0.93 ? "gift" : "flake";
        r.things.push({ x: 20 + Math.random() * (W - 40), y: H + 30, kind, r: kind === "rock" ? 13 : kind === "gift" || kind === "flake" ? 14 : 16 });
        r.spawnIn = Math.max(0.16, 0.62 - r.dist / 60000) * (0.6 + Math.random() * 0.8);
      }
      for (const th of r.things) th.y -= speed * dt;
      r.things = r.things.filter((th) => th.y > -40 && !th.hit);
      // Bumps and grabs.
      for (const th of r.things) {
        if (Math.hypot(th.x - r.x, th.y - SLED_Y) > th.r + 12) continue;
        if (th.kind === "gift") {
          th.hit = true;
          r.gifts++;
          sfx.coin();
        } else if (th.kind === "flake") {
          th.hit = true;
          r.boostUntil = r.t + 2;
          sfx.levelUp();
        } else if (r.t >= r.safeUntil) {
          if (r.shields > 0) {
            r.shields--;
            th.hit = true;
            r.safeUntil = r.t + 1.2;
            save((s) => ({ ...s, shields: Math.max(0, s.shields - 1) }));
            sfx.wrong();
          } else {
            r.over = true;
            sfx.wrong();
            finish(r);
            return;
          }
        }
      }
      // A trail in the snow.
      r.trail.push({ x: r.x, y: SLED_Y + 10, life: 1 });
      for (const p of r.trail) {
        p.y -= speed * dt;
        p.life -= dt * 1.2;
      }
      r.trail = r.trail.filter((p) => p.life > 0 && p.y > -10);

      // Draw.
      ctx.fillStyle = "#f4f9ff";
      ctx.fillRect(0, 0, W, H);
      // Moving snow ripples, so the hill feels fast.
      ctx.strokeStyle = "rgba(148, 190, 230, 0.35)";
      ctx.lineWidth = 2;
      const off = (r.dist * 0.6) % 60;
      for (let y = -off; y < H; y += 60) {
        ctx.beginPath();
        ctx.moveTo(0, y + 30);
        ctx.quadraticCurveTo(W / 2, y + 10, W, y + 35);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(120, 170, 220, 0.35)";
      for (const p of r.trail) {
        ctx.globalAlpha = p.life * 0.6;
        ctx.fillRect(p.x - 7, p.y, 3, 4);
        ctx.fillRect(p.x + 4, p.y, 3, 4);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const th of r.things) {
        ctx.font = `${th.r * 2.2}px system-ui`;
        ctx.fillText(LOOK[th.kind], th.x, th.y);
      }
      // The sled leans the way you steer; it blinks while a shield just saved you.
      if (r.t >= r.safeUntil || Math.floor(r.t * 10) % 2 === 0) {
        ctx.save();
        ctx.translate(r.x, SLED_Y);
        ctx.rotate(Math.max(-0.4, Math.min(0.4, (r.target - r.x) / 120)));
        ctx.font = "34px system-ui";
        ctx.fillText("🛷", 0, 0);
        ctx.restore();
      }
      if (r.shields > 0) {
        ctx.font = "16px system-ui";
        ctx.fillText("🛡️".repeat(r.shields), r.x, SLED_Y - 26);
      }
      if (r.t < r.boostUntil) {
        ctx.font = "bold 16px system-ui";
        ctx.fillStyle = "#0284c7";
        ctx.fillText("❄️ SPEED BURST", W / 2, 28);
      }
      if (now - hud > 150) {
        hud = now;
        setRun({ score: Math.floor(r.dist / 10) + r.gifts * 25, dist: Math.floor(r.dist / 10), gifts: r.gifts, over: false });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [runId, tab, finish, save]);

  // Arrow keys / A and D steer.
  useEffect(() => {
    const set = (e: KeyboardEvent, down: boolean) => {
      if (e.key === "ArrowLeft" || e.key === "a") keys.current.left = down;
      if (e.key === "ArrowRight" || e.key === "d") keys.current.right = down;
    };
    const kd = (e: KeyboardEvent) => set(e, true);
    const ku = (e: KeyboardEvent) => set(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, []);

  // Point or drag to steer.
  const steer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = live.current;
    if (!r) return;
    const b = e.currentTarget.getBoundingClientRect();
    r.target = ((e.clientX - b.left) / b.width) * W;
  };

  const riding = run && !run.over;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 text-sm font-bold">
        <span className="rounded-full bg-black/30 px-3 py-1.5">🪙 {coins}</span>
        <span className="rounded-full bg-black/30 px-3 py-1.5">🏆 best {saved.best}</span>
        <span className="rounded-full bg-black/30 px-3 py-1.5">🛡️ {saved.shields}</span>
      </div>
      <Tabs tab={tab} setTab={setTab} earnBadge={coins < RUN_COST ? "!" : undefined} />
      {tab === "earn" ? (
        earn
      ) : (
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            onPointerDown={steer}
            onPointerMove={(e) => e.buttons && steer(e)}
            className="mx-auto block aspect-[2/3] w-full max-w-sm touch-none rounded-3xl bg-[#f4f9ff] shadow-xl"
            aria-label="Sled Dash. Drag or use the arrow keys to steer."
          />
          {riding && (
            <p className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 font-mono text-sm font-bold text-white">
              {run.dist} m · 🎁 {run.gifts}
            </p>
          )}
          {!riding && (
            <div className="absolute inset-0 mx-auto flex max-w-sm flex-col items-center justify-center gap-3 rounded-3xl bg-sky-950/55 p-6 text-center text-white backdrop-blur-[2px]">
              {run?.over ? (
                <>
                  <p className="text-4xl">💥</p>
                  <p className="text-xl font-black">crashed!</p>
                  <p className="text-sm">
                    {run.dist} m + 🎁 {run.gifts} = <b>{run.score}</b> {run.score >= saved.best && run.score > 0 ? "🏆 new best!!" : ""}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-5xl">🛷</p>
                  <p className="text-xl font-black">Sled Dash</p>
                  <p className="text-sm text-white/85">dodge 🌲🪨⛄, grab 🎁 n ❄️. drag or ←/→ to steer.</p>
                </>
              )}
              <button type="button" onClick={start} disabled={coins < RUN_COST} className="rounded-full bg-amber-300 px-6 py-3 text-lg font-black text-black shadow-lg disabled:opacity-50">
                {run?.over ? "🛷 ride again" : "🛷 ride"} (🪙{RUN_COST})
              </button>
              <button type="button" onClick={buyShield} disabled={coins < SHIELD_COST || saved.shields >= MAX_SHIELDS} className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold disabled:opacity-50">
                🛡️ buy a shield (🪙{SHIELD_COST}) · {saved.shields}/{MAX_SHIELDS}
              </button>
              {coins < RUN_COST && (
                <button type="button" onClick={() => setTab("earn")} className="text-sm font-semibold underline">
                  answer questions for coins →
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

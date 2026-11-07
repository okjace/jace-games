"use client";

import { useEffect, useRef, useState } from "react";
import { setupCanvas } from "@/components/games/shared";
import { FISH, RARITY_COLOR, RARITY_ORDER, SPECIALS, oddsText, type Rarity } from "@/lib/live/fish";
import type { Catch } from "@/lib/live/party";
import { useJuice } from "../fx/Juice";
import { sfx } from "../fx/sfx";
import type { StageProps } from "./index";

/**
 * Lake Frenzy: every right answer (or tap) is a cast. The server rolls the
 * catch; this screen casts the line, waits for the bite, and shows the
 * catch on a card in its rarity's colour. The Fishdex lists every fish.
 */

const W = 480;
const H = 220;
const BIG: Rarity[] = ["Legendary", "Mythic", "Secret"];

export function LakeFrenzy({ view, earn }: StageProps) {
  const juice = useJuice();
  const [reveal, setReveal] = useState<Catch | null>(null);
  const [casting, setCasting] = useState(false);
  const [dexOpen, setDexOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const castAt = useRef(0);
  const p = view.party;
  const last = view.last;

  // The lake: waves, a bobbing boat, and the line when casting.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = setupCanvas(canvas, W, H);
    let raf = 0;
    const draw = (t: number) => {
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.45);
      sky.addColorStop(0, "#7dd3fc");
      sky.addColorStop(1, "#bae6fd");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      // Far hills and trees.
      ctx.fillStyle = "#4d7c0f";
      ctx.beginPath();
      ctx.moveTo(0, H * 0.45);
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, H * 0.38 + Math.sin(x / 50) * 10);
      ctx.lineTo(W, H * 0.45);
      ctx.fill();
      // Sun.
      ctx.fillStyle = "#fde047";
      ctx.beginPath();
      ctx.arc(W - 60, 36, 18, 0, Math.PI * 2);
      ctx.fill();
      // Water with moving wave lines.
      const water = ctx.createLinearGradient(0, H * 0.45, 0, H);
      water.addColorStop(0, "#0ea5e9");
      water.addColorStop(1, "#075985");
      ctx.fillStyle = water;
      ctx.fillRect(0, H * 0.45, W, H);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 2;
      for (let row = 0; row < 5; row++) {
        const y = H * 0.52 + row * 24;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 8) ctx.lineTo(x, y + Math.sin(x / 26 + t / 600 + row) * 3);
        ctx.stroke();
      }
      // Boat.
      const bob = Math.sin(t / 500) * 3;
      const bx = 110;
      const by = H * 0.5 + bob;
      ctx.fillStyle = "#92400e";
      ctx.beginPath();
      ctx.moveTo(bx - 50, by);
      ctx.lineTo(bx + 50, by);
      ctx.lineTo(bx + 34, by + 18);
      ctx.lineTo(bx - 34, by + 18);
      ctx.closePath();
      ctx.fill();
      ctx.font = "28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🧑", bx, by - 8);
      // Rod and line.
      const since = t - castAt.current;
      const castT = Math.min(1, since / 500);
      const tipX = bx + 20;
      const tipY = by - 40;
      ctx.strokeStyle = "#78350f";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bx + 6, by - 12);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      const bobberX = tipX + 220 * castT;
      const bobberY = H * 0.6 + (casting && since > 700 ? Math.sin(t / 60) * 4 : Math.sin(t / 400) * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.quadraticCurveTo((tipX + bobberX) / 2, tipY - 40 * (1 - castT), bobberX, bobberY);
      ctx.stroke();
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(bobberX, bobberY, 5, 0, Math.PI * 2);
      ctx.fill();
      if (casting && since > 700) {
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        for (let k = 0; k < 2; k++) {
          ctx.beginPath();
          ctx.ellipse(bobberX, bobberY + 4, 8 + ((t / 15 + k * 12) % 24), 3 + ((t / 40 + k * 4) % 8), 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [casting]);

  // A new catch: cast, wait for the bite, then show the card.
  const latest = last?.kind === "catch" ? (last.catch as Catch) : null;
  const latestKey = latest ? `${view.me.answered}-${latest.id}-${latest.weight}` : "";
  const shown = useRef(latestKey);
  useEffect(() => {
    if (!latest || latestKey === shown.current) return;
    shown.current = latestKey;
    castAt.current = performance.now();
    setCasting(true);
    sfx.whoosh();
    const t = setTimeout(() => {
      setCasting(false);
      setReveal(latest);
      sfx.splash();
      if (latest.rarity && BIG.includes(latest.rarity)) {
        sfx.levelUp();
        juice.confetti(latest.rarity === "Secret" ? 220 : 120);
        juice.flash("rgba(250,204,21,0.4)");
      } else if (latest.kind === "fish" || latest.kind === "treasure") sfx.coin();
    }, 1400);
    return () => clearTimeout(t);
    // latestKey identifies the catch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestKey]);

  const caughtCount = Object.keys(p.caught ?? {}).length;
  const color = reveal?.rarity ? RARITY_COLOR[reveal.rarity] : "#94a3b8";

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-3xl border-4 border-white/30 shadow-xl">
        <canvas ref={canvasRef} className="block aspect-[24/11] w-full" aria-label="The lake" />
        {(p.frenzy ?? 0) > 0 && <span className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-sky-700 shadow">🫧 Frenzy ×2 · {p.frenzy} left</span>}
        {p.stormed && <span className="absolute left-3 top-3 rounded-full bg-neutral-800/90 px-3 py-1 text-xs font-black text-white shadow">⛈️ Stormy: next catch halved</span>}
        {casting && <span className="absolute inset-x-0 bottom-3 text-center text-lg font-black text-white drop-shadow">Something&apos;s biting…</span>}
        <button type="button" onClick={() => setDexOpen(true)} className="absolute bottom-3 right-3 rounded-full bg-black/40 px-3 py-1.5 text-xs font-black text-white backdrop-blur">
          📖 Fishdex {caughtCount}/{FISH.length}
        </button>
      </div>

      {reveal ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl bg-white p-6 text-center text-neutral-900 shadow-[0_6px_0_rgba(0,0,0,0.2)]" style={{ animation: "jg-rise 0.3s ease-out", boxShadow: reveal.rarity && BIG.includes(reveal.rarity) ? `0 0 30px 6px ${color}` : undefined }}>
          {last?.firstCatch === true && <span className="rounded-full bg-[#facc15] px-3 py-0.5 text-xs font-black">NEW! Added to your Fishdex</span>}
          <span className="text-7xl" style={{ animation: "jg-wiggle 0.6s ease-in-out 2" }}>
            {reveal.icon}
          </span>
          <p className="text-2xl font-black">{reveal.name}</p>
          {reveal.rarity && (
            <p className="rounded-full px-3 py-0.5 text-xs font-black uppercase tracking-widest" style={{ background: color, color: reveal.rarity === "Secret" ? "#000" : "#111" }}>
              {reveal.rarity}
            </p>
          )}
          {reveal.kind === "fish" || reveal.kind === "treasure" ? (
            <p className="text-xl font-bold">{reveal.weight} lb</p>
          ) : (
            <p className="text-sm text-neutral-600">{SPECIALS.find((s) => s.id === reveal.id)?.blurb}</p>
          )}
          <button type="button" autoFocus onClick={() => setReveal(null)} className="mt-2 h-12 rounded-full bg-sky-600 px-8 font-black text-white shadow-[0_4px_0_rgba(0,0,0,0.25)] active:translate-y-1">
            Cast again
          </button>
        </div>
      ) : casting ? null : (
        earn
      )}

      {(p.catches ?? []).length > 0 && (
        <div className="flex gap-2 overflow-x-auto rounded-3xl bg-black/20 p-3">
          {(p.catches ?? []).map((c, i) => (
            <span key={i} className="flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold" style={{ boxShadow: c.rarity ? `inset 0 0 0 2px ${RARITY_COLOR[c.rarity]}` : undefined }}>
              {c.icon} {c.kind === "fish" || c.kind === "treasure" ? `${c.weight} lb` : c.name}
            </span>
          ))}
        </div>
      )}

      {dexOpen && <Fishdex caught={p.caught ?? {}} onClose={() => setDexOpen(false)} />}
    </div>
  );
}

/** Every fish in the lake, grouped by rarity, with odds and your best catch. */
function Fishdex({ caught, onClose }: { caught: Record<string, number>; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Fishdex"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-t-3xl bg-gradient-to-b from-sky-900 to-sky-950 p-5 text-white shadow-2xl sm:rounded-3xl"
        style={{ animation: "jg-rise 0.25s ease-out" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black">📖 Fishdex</h2>
          <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-bold">
            {Object.keys(caught).length}/{FISH.length} caught
          </span>
        </div>
        <p className="text-xs text-white/70">A longer streak is a better lure: heavier fish and slightly better odds on rare ones.</p>
        {RARITY_ORDER.map((r) => {
          const fish = FISH.filter((f) => f.rarity === r);
          return (
            <section key={r}>
              <h3 className="mb-1.5 text-xs font-black uppercase tracking-widest" style={{ color: RARITY_COLOR[r] }}>
                {r}
              </h3>
              <ul className="flex flex-col gap-1.5">
                {fish.map((f) => {
                  const best = caught[f.id];
                  const known = best !== undefined || r !== "Secret";
                  return (
                    <li key={f.id} className="flex items-center gap-3 rounded-2xl bg-white/10 p-2.5" style={{ boxShadow: best ? `inset 0 0 0 2px ${RARITY_COLOR[r]}` : undefined }}>
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-2xl ${best ? "" : "grayscale opacity-60"}`}>{known ? f.icon : "❔"}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold">{known ? f.name : "???"}</span>
                        <span className="block text-xs text-white/70">{known ? f.blurb : "Nobody knows what's down there…"}</span>
                      </span>
                      <span className="shrink-0 text-right text-xs">
                        <span className="block font-bold">{oddsText(f.weight)}</span>
                        <span className="block text-white/70">
                          {f.min}–{f.max} lb
                        </span>
                        {best !== undefined && <span className="block font-black" style={{ color: RARITY_COLOR[r] }}>Best {best} lb</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        <section>
          <h3 className="mb-1.5 text-xs font-black uppercase tracking-widest text-white/70">Other things in the lake</h3>
          <ul className="flex flex-col gap-1.5">
            {SPECIALS.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-2xl bg-white/10 p-2.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-2xl">{s.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{s.name}</span>
                  <span className="block text-xs text-white/70">{s.blurb}</span>
                </span>
                <span className="shrink-0 text-xs font-bold">{oddsText(s.weight)}</span>
              </li>
            ))}
          </ul>
        </section>
        <button type="button" onClick={onClose} className="mt-1 h-12 rounded-full bg-white font-black text-sky-900">
          Back to fishing
        </button>
      </div>
    </div>
  );
}

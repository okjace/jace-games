"use client";

import { useEffect, useRef, useState } from "react";
import { DRAGONS, DRAGON_RARITY_COLOR } from "@/lib/live/moreModes";
import { useJuice } from "../fx/Juice";
import { sfx } from "../fx/sfx";
import type { StageProps } from "./index";

/**
 * Stages for Summit Climb, Last One Standing, Boss Battle and Tug of War
 * (skill only: right answers move you, wrong ones cost you) and for Dragon
 * Hatchery and Piñata Party (luck). The server decides everything; these
 * screens show it and make it feel good.
 */

/** Runs `fn` once each time `key` changes (after the first render). */
function useOnChange(key: string, fn: () => void) {
  const seen = useRef(key);
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  });
  useEffect(() => {
    if (key === seen.current) return;
    seen.current = key;
    latest.current();
  }, [key]);
}

const panel = "rounded-3xl bg-black/25 p-4 backdrop-blur";

// ---------- Summit Climb ----------

export function SummitClimb({ view, earn }: StageProps) {
  const juice = useJuice();
  const s = view.party.skill ?? {};
  const goal = s.goal ?? 20;
  const steps = view.me.score;
  const pct = Math.min(100, (steps / goal) * 100);
  useOnChange(`${view.me.answered}-${steps}`, () => {
    if (view.last?.kind === "summit") {
      sfx.correct();
      juice.pop(`+${String(view.last.gain)} ⛰️`, "#e0f2fe");
    } else if (view.last?.slid) {
      sfx.wrong();
      juice.shake();
    }
  });
  return (
    <div className="flex flex-col gap-3">
      <div className={`${panel} relative h-56 overflow-hidden`}>
        {/* The mountain, with the summit flag at the top. */}
        <div className="absolute inset-x-6 bottom-0 top-6" style={{ clipPath: "polygon(50% 0, 100% 100%, 0 100%)", background: "linear-gradient(180deg,#f8fafc 0 18%,#64748b 18% 100%)" }} />
        <span className="absolute left-1/2 top-1 -translate-x-1/2 text-2xl">🚩</span>
        {/* You, climbing. */}
        <span
          className="absolute left-1/2 text-3xl transition-[bottom] duration-500"
          style={{ bottom: `calc(${pct * 0.82}% + 4px)`, transform: `translateX(${(1 - pct / 100) * 40 - 20}px)` }}
          aria-label={`You're on step ${steps} of ${goal}`}
        >
          🧗
        </span>
        <div className="absolute bottom-2 left-3 rounded-full bg-black/40 px-3 py-1 text-sm font-black">
          Step {steps}/{goal}
        </div>
        {s.leader && s.leader.name !== view.me.name && (
          <div className="absolute right-3 top-3 rounded-full bg-black/40 px-3 py-1 text-xs font-bold">
            Leader: {s.leader.name} ({s.leader.value})
          </div>
        )}
      </div>
      {view.last?.slid ? <p className="text-center text-sm font-bold text-red-200">Wrong answer: you slid back a step.</p> : null}
      <p className="text-center text-xs font-semibold text-white/80">Right answers climb (2 steps on a streak of 3+). Wrong ones slide you back.</p>
      {earn}
    </div>
  );
}

// ---------- Last One Standing ----------

export function LastStanding({ view, earn }: StageProps) {
  const juice = useJuice();
  const s = view.party.skill ?? {};
  const lives = s.lives ?? 3;
  useOnChange(String(lives), () => {
    sfx.wrong();
    juice.shake();
    juice.flash("rgba(239,68,68,0.45)");
  });
  return (
    <div className="flex flex-col gap-3">
      <div className={`${panel} flex items-center justify-between`}>
        <p className="text-3xl tracking-wider" aria-label={`${lives} lives left`}>
          {Array.from({ length: s.maxLives ?? 3 }, (_, i) => (
            <span key={i} className={i < lives ? "" : "opacity-25 grayscale"}>
              ❤️
            </span>
          ))}
        </p>
        <p className="text-sm font-bold">{s.alive ?? 0} still standing</p>
      </div>
      {s.out ? (
        <div className={`${panel} py-8 text-center`}>
          <p className="text-5xl">💀</p>
          <p className="mt-2 text-2xl font-black">You&apos;re out!</p>
          <p className="text-sm text-white/80">You got {view.me.score} right. Watch the others finish.</p>
        </div>
      ) : (
        <>
          <p className="text-center text-xs font-semibold text-white/80">Every wrong answer costs a life. Most right answers wins.</p>
          {earn}
        </>
      )}
    </div>
  );
}

// ---------- Boss Battle ----------

export function BossBattle({ view, earn }: StageProps) {
  const juice = useJuice();
  const s = view.party.skill ?? {};
  const hp = s.hp ?? 0;
  const max = s.maxHp ?? 1;
  const [hit, setHit] = useState(0);
  useOnChange(`${view.me.answered}-${view.me.score}-${s.healed}`, () => {
    if (view.last?.kind === "boss") {
      sfx.boom();
      juice.pop(`-${String(view.last.gain)} HP`, "#fca5a5");
      setHit((n) => n + 1);
    } else if (view.last?.healed) {
      sfx.wrong();
      juice.pop(`Boss healed +${String(view.last.healed)}`, "#86efac");
    }
  });
  return (
    <div className="flex flex-col gap-3">
      <div className={`${panel} flex flex-col items-center gap-2`}>
        <span key={hit} className="text-8xl drop-shadow-[0_6px_0_rgba(0,0,0,0.4)]" style={{ animation: hit ? "jg-shake 0.35s ease-in-out" : "jg-bob 2.4s ease-in-out infinite" }}>
          🐲
        </span>
        <p className="text-lg font-black uppercase tracking-wider">The Quizzard Wyrm</p>
        <div className="h-5 w-full overflow-hidden rounded-full border-2 border-white/60 bg-black/40" role="progressbar" aria-valuenow={hp} aria-valuemax={max} aria-label="Boss health">
          <div className="h-full rounded-full bg-gradient-to-r from-red-600 to-orange-400 transition-[width] duration-500" style={{ width: `${(hp / max) * 100}%` }} />
        </div>
        <p className="text-sm font-bold">
          {hp.toLocaleString()} / {max.toLocaleString()} HP
        </p>
        <p className="text-xs text-white/80">
          Your damage: {(s.dealt ?? 0).toLocaleString()}
          {(s.healed ?? 0) > 0 && ` · you healed it ${s.healed}`}
        </p>
      </div>
      <p className="text-center text-xs font-semibold text-white/80">Right answers hit (harder on a streak). Wrong answers heal the boss. Beat it together!</p>
      {earn}
    </div>
  );
}

// ---------- Tug of War ----------

export function TugOfWar({ view, earn }: StageProps) {
  const juice = useJuice();
  const s = view.party.skill ?? {};
  const goal = s.goal ?? 10;
  const rope = s.rope ?? 0; // positive: red is winning
  const mine = s.team ?? "red";
  // Where the knot sits: 0% is the red line, 100% the blue line.
  const knot = 50 - Math.max(-1, Math.min(1, rope / goal)) * 50;
  useOnChange(`${view.me.answered}-${view.me.score}`, () => {
    if (view.last?.kind === "tug") {
      sfx.whoosh();
      juice.pop(`+${String(view.last.gain)} pull`, mine === "red" ? "#fca5a5" : "#93c5fd");
    }
  });
  return (
    <div className="flex flex-col gap-3">
      <div className={`${panel} flex flex-col gap-3`}>
        <p className="text-center text-lg font-black">
          You&apos;re on <span className={mine === "red" ? "text-red-300" : "text-blue-300"}>{mine === "red" ? "🔴 Red" : "🔵 Blue"}</span>
        </p>
        <div className="relative h-14">
          <div className="absolute inset-y-0 left-0 w-1 bg-red-400" />
          <div className="absolute inset-y-0 right-0 w-1 bg-blue-400" />
          <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-amber-700" />
          <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl transition-[left] duration-500" style={{ left: `${knot}%` }} aria-label="The knot in the middle of the rope">
            🎀
          </span>
          <span className="absolute -bottom-1 left-0 text-2xl">🧍</span>
          <span className="absolute -bottom-1 right-0 text-2xl">🧍</span>
        </div>
        <div className="flex justify-between text-sm font-bold">
          <span className="text-red-300">🔴 {s.red ?? 0} pulls</span>
          <span className="text-blue-300">{s.blue ?? 0} pulls 🔵</span>
        </div>
      </div>
      <p className="text-center text-xs font-semibold text-white/80">Every right answer pulls the rope your way (2 on a streak of 3+). Drag it over your line to win!</p>
      {earn}
    </div>
  );
}

// ---------- Dragon Hatchery ----------

export function DragonHatchery({ view, earn }: StageProps) {
  const juice = useJuice();
  const [book, setBook] = useState(false);
  const owned = view.party.dragons ?? {};
  const last = view.last?.kind === "hatch" ? view.last : null;
  const dragon = last ? DRAGONS.find((d) => d.id === last.dragon) : null;
  useOnChange(`${view.me.answered}-${String(last?.dragon)}-${String(last?.power)}`, () => {
    if (!dragon) return;
    const big = dragon.rarity === "Legendary" || dragon.rarity === "Mythic";
    if (big) {
      sfx.levelUp();
      juice.confetti(140);
      juice.flash("rgba(250,204,21,0.45)");
    } else sfx.open();
    juice.pop(`⚡ +${String(last?.power)}`, DRAGON_RARITY_COLOR[dragon.rarity]);
  });
  const found = Object.keys(owned).length;
  return (
    <div className="flex flex-col gap-3">
      {dragon && last ? (
        <div key={`${view.me.answered}`} className={`${panel} flex flex-col items-center gap-1 text-center`} style={{ animation: "jg-zoom 0.45s ease-out" }}>
          <p className="text-xs font-bold uppercase tracking-widest text-white/70">{last.first ? "New dragon!" : "Hatched"}</p>
          <span className="text-7xl">{dragon.icon}</span>
          <p className="text-2xl font-black">{dragon.name}</p>
          <p className="text-sm font-black uppercase tracking-wider" style={{ color: DRAGON_RARITY_COLOR[dragon.rarity] }}>
            {dragon.rarity} · ⚡ {String(last.power)}
          </p>
        </div>
      ) : (
        <div className={`${panel} py-6 text-center`}>
          <span className="inline-block text-7xl" style={{ animation: "jg-wiggle 1.2s ease-in-out infinite" }}>
            🥚
          </span>
          <p className="mt-1 font-bold">Answer right to hatch your first egg!</p>
        </div>
      )}
      <button type="button" onClick={() => setBook((b) => !b)} className="rounded-full bg-black/25 px-4 py-2 text-sm font-bold backdrop-blur">
        📖 Dragon book: {found}/{DRAGONS.length} found {book ? "▲" : "▼"}
      </button>
      {book && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {DRAGONS.map((d) => {
            const has = owned[d.id] !== undefined;
            return (
              <li key={d.id} className="flex flex-col items-center rounded-2xl bg-black/25 p-2 text-center text-xs" style={{ border: `2px solid ${has ? DRAGON_RARITY_COLOR[d.rarity] : "transparent"}` }}>
                <span className={`text-3xl ${has ? "" : "opacity-30 grayscale"}`}>{has ? d.icon : "❔"}</span>
                <span className="font-bold">{has ? d.name : "???"}</span>
                <span style={{ color: DRAGON_RARITY_COLOR[d.rarity] }}>{d.rarity}</span>
                {has && <span className="text-white/70">best ⚡ {owned[d.id]}</span>}
              </li>
            );
          })}
        </ul>
      )}
      {earn}
    </div>
  );
}

// ---------- Piñata Party ----------

const WHACK_TEXT: Record<string, { text: string; color: string }> = {
  candy: { text: "Candy!", color: "#fde68a" },
  explosion: { text: "CANDY EXPLOSION!", color: "#f472b6" },
  golden: { text: "GOLDEN PIÑATA!", color: "#facc15" },
  dud: { text: "Just a few crumbs…", color: "#cbd5e1" },
};

export function PinataParty({ view, earn }: StageProps) {
  const juice = useJuice();
  const last = view.last?.kind === "whack" ? view.last : null;
  const kind = String(last?.whack ?? "");
  const [swing, setSwing] = useState(0);
  useOnChange(`${view.me.answered}-${kind}-${String(last?.candy)}`, () => {
    if (!last) return;
    setSwing((n) => n + 1);
    if (kind === "golden") {
      sfx.levelUp();
      juice.confetti(160);
      juice.flash("rgba(250,204,21,0.5)");
    } else if (kind === "explosion") {
      sfx.boom();
      juice.confetti(90);
    } else if (kind === "dud") sfx.wrong();
    else sfx.coin();
    juice.pop(`+${String(last.candy)} 🍬`, WHACK_TEXT[kind]?.color ?? "#fde68a");
  });
  const info = WHACK_TEXT[kind];
  return (
    <div className="flex flex-col gap-3">
      <div className={`${panel} flex flex-col items-center gap-2 py-5 text-center`}>
        <span key={swing} className="text-8xl" style={{ animation: swing ? "jg-wiggle 0.5s ease-in-out 2" : "jg-bob 2s ease-in-out infinite", transformOrigin: "top center" }}>
          🪅
        </span>
        {info && last ? (
          <>
            <p className="text-2xl font-black" style={{ color: info.color }}>
              {info.text}
            </p>
            <p className="text-3xl font-black">+{String(last.candy)} 🍬</p>
          </>
        ) : (
          <p className="font-bold">Answer right to take a whack!</p>
        )}
      </div>
      {earn}
    </div>
  );
}

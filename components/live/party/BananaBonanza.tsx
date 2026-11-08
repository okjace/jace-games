"use client";

import { useEffect, useRef, useState } from "react";
import { BANANA_EVENTS, GO_BANANAS_MS, type BananaEventId } from "@/lib/live/banana";
import { useJuice } from "../fx/Juice";
import { sfx } from "../fx/sfx";
import type { StageProps } from "./index";

/**
 * Banana Bonanza: answer (or tap) to peel a banana event. The server rolls
 * it; this screen makes it loud: a slam-in card, bananas bursting out,
 * shakes for the bad ones, and GO BANANAS turns the whole stage into a
 * wobbling rainbow banana storm.
 */

/** Bananas drifting across the background (positions fixed so the server and browser agree). */
const FLOATERS = Array.from({ length: 14 }, (_, i) => ({
  left: (i * 37) % 100,
  top: (i * 53) % 100,
  size: 18 + ((i * 7) % 22),
  delay: (i * 0.37) % 3,
  spin: i % 2 ? 1 : -1,
}));

export function BananaBonanza({ view, earn }: StageProps) {
  const juice = useJuice();
  const last = view.last?.kind === "banana" ? view.last : null;
  const event = (last?.event as BananaEventId | undefined) ?? null;
  const amount = Number(last?.amount ?? 0);
  const eventKey = last ? `${view.me.answered}-${event}-${amount}` : "";

  // GO BANANAS countdown.
  const goUntil = view.party.goUntil ?? 0;
  const [now, setNow] = useState(() => Date.now());
  const skew = view.serverNow - now;
  useEffect(() => {
    if (!goUntil) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [goUntil]);
  const goLeft = Math.max(0, goUntil - (now + skew));
  const going = goLeft > 0;

  // Make each new event loud.
  const seen = useRef(eventKey);
  useEffect(() => {
    if (!event || eventKey === seen.current) return;
    seen.current = eventKey;
    if (event === "golden" || event === "mega") {
      sfx.levelUp();
      juice.confetti(160);
      juice.flash("rgba(250,204,21,0.55)");
    } else if (event === "go") {
      sfx.streak(10);
      juice.flash("rgba(236,72,153,0.5)");
      juice.shake();
    } else if (event === "rotten" || event === "slip") {
      sfx.wrong();
      juice.shake();
      juice.flash("rgba(132,204,22,0.45)");
    } else if (event === "monkey") {
      sfx.alarm();
      juice.shake();
    } else if (event === "rain" || event === "split") {
      sfx.cash();
      juice.confetti(60);
    } else sfx.coin();
    juice.pop(`${amount >= 0 ? "+" : ""}${amount} 🍌`, amount >= 0 ? "#facc15" : "#84cc16");
  }, [event, eventKey, amount, juice]);

  const info = event ? BANANA_EVENTS[event] : null;
  const detail =
    event === "monkey" && last?.target
      ? `Your monkey swiped ${amount} from ${String(last.target)}!`
      : event === "split" && last?.target
        ? `You and ${String(last.target)} each got bananas.`
        : event === "rain"
          ? "Everyone got 10 bananas, you got the most!"
          : event === "mega"
            ? "Your pile just doubled!"
            : event === "go"
              ? `Everything is ×3 for ${GO_BANANAS_MS / 1000} seconds. ANSWER FAST!`
              : event === "rotten"
                ? "Ew. Some of your bananas went bad."
                : event === "slip"
                  ? "Whoops. You dropped a few."
                  : last?.going
                    ? "GO BANANAS ×3!"
                    : null;

  return (
    <div className={`relative flex flex-col gap-3 ${going ? "animate-[jg-wiggle_0.5s_ease-in-out_infinite]" : ""}`}>
      {/* Floating bananas behind everything; a storm of them while going bananas. */}
      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden" aria-hidden="true">
        {FLOATERS.map((f, i) => (
          <span
            key={i}
            className="absolute opacity-30"
            style={{
              left: `${f.left}%`,
              top: `${f.top}%`,
              fontSize: f.size * (going ? 1.4 : 1),
              animation: `jg-bob ${going ? 0.6 : 2.4 + f.delay}s ease-in-out ${f.delay}s infinite`,
              transform: `rotate(${f.spin * 25}deg)`,
            }}
          >
            🍌
          </span>
        ))}
        {going &&
          FLOATERS.map((f, i) => (
            <span key={`r${i}`} className="jg-rain absolute top-0" style={{ left: `${(f.left + 7) % 100}%`, fontSize: 26, animation: `jg-rain ${1.6 + f.delay / 2}s linear ${f.delay / 3}s infinite` }}>
              🍌
            </span>
          ))}
      </div>

      {going && (
        <div
          className="relative overflow-hidden rounded-2xl p-3 text-center font-black text-black shadow-lg"
          style={{ background: "linear-gradient(90deg,#f43f5e,#f59e0b,#facc15,#22c55e,#06b6d4,#8b5cf6,#f43f5e)", backgroundSize: "200% 100%", animation: "jg-shimmer 0.6s linear infinite" }}
        >
          <p className="text-2xl tracking-wide">🤪 GO BANANAS! ×3 🤪</p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/25">
            <div className="h-full rounded-full bg-white transition-[width] duration-200" style={{ width: `${(goLeft / GO_BANANAS_MS) * 100}%` }} />
          </div>
        </div>
      )}

      {info && (
        <div
          key={eventKey}
          className={`relative overflow-hidden rounded-3xl p-5 text-center shadow-[0_8px_0_rgba(0,0,0,0.25)] ${amount < 0 ? "bg-lime-700/85" : "bg-yellow-300 text-amber-950"}`}
          style={{ animation: "jg-zoom 0.45s cubic-bezier(.2,1.6,.4,1)" }}
        >
          <Burst count={amount > 0 ? Math.min(18, 6 + Math.round(amount / 10)) : 0} />
          <p className="relative text-6xl drop-shadow" style={{ animation: "jg-wiggle 0.6s ease-in-out 2" }}>
            {info.icon}
          </p>
          <p className="relative mt-1 text-3xl font-black uppercase tracking-wide">{info.name}</p>
          <p className="relative text-4xl font-black tabular-nums">
            {amount >= 0 ? "+" : ""}
            {amount} 🍌
          </p>
          {detail && <p className="relative mt-1 text-sm font-bold opacity-90">{detail}</p>}
        </div>
      )}

      <div className="relative">{earn}</div>
    </div>
  );
}

/** Bananas flying out from the middle of the event card (plays once, on mount). */
function Burst({ count }: { count: number }) {
  if (!count) return null;
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const dist = 90 + (i % 3) * 40;
        return (
          <span
            key={i}
            className="absolute left-1/2 top-1/2 text-2xl"
            style={
              {
                "--dx": `${Math.cos(angle) * dist}px`,
                "--dy": `${Math.sin(angle) * dist}px`,
                animation: `jg-burst 0.9s ease-out ${(i % 4) * 0.03}s both`,
              } as React.CSSProperties
            }
          >
            🍌
          </span>
        );
      })}
    </div>
  );
}

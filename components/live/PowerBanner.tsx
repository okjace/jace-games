"use client";

import { useEffect, useState } from "react";
import type { EventView } from "@/lib/live/engine";

/** The power-up event on right now, with its countdown. `big` for the host's screen. */
export function PowerBanner({ event, serverNow, big = false }: { event: EventView | null; serverNow: number; big?: boolean }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!event) return;
    const skew = serverNow - Date.now();
    const tick = () => setLeft(Math.max(0, Math.ceil((event.endsAt - (Date.now() + skew)) / 1000)));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
    // Only restart for a new event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, event?.endsAt]);
  if (!event || left === 0) return null;
  return (
    <div role="status" className={`jl-pop-in flex items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-400 via-pink-500 to-violet-500 text-white shadow-lg ${big ? "px-6 py-4" : "px-4 py-2"}`}>
      <span className={big ? "text-5xl" : "text-3xl"}>{event.icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`block font-black uppercase tracking-wide ${big ? "text-3xl" : "text-lg"}`}>{event.name}!</span>
        <span className={`block font-semibold opacity-90 ${big ? "text-lg" : "text-xs"}`}>
          {event.kind === "jackpot" && event.claimedBy ? `🎉 ${event.claimedBy} won the jackpot!!` : event.desc}
        </span>
      </span>
      {left !== null && <span className={`shrink-0 font-mono font-black tabular-nums ${big ? "text-4xl" : "text-xl"}`}>{left}s</span>}
    </div>
  );
}

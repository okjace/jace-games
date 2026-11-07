"use client";

import { useState } from "react";
import type { PlayerView } from "@/lib/live/engine";
import { useCountUp, useJuice } from "../fx/Juice";
import { sfx } from "../fx/sfx";
import type { Act } from "./shared";

const ITEMS = [
  { id: "earn", icon: "💵", name: "Earnings", desc: "+25% on every reward", max: 5 },
  { id: "streak", icon: "🔥", name: "Streak Bonus", desc: "Extra for every answer in a row", max: 5 },
  { id: "multi", icon: "✖️", name: "Multiplier", desc: "×1.5 on everything you earn", max: 3 },
  { id: "shield", icon: "🛡️", name: "Shield", desc: "Saves your streak from one wrong answer", max: 0 },
] as const;

/**
 * The upgrade shop for Gold Rush and Code Breakers. Your score is your
 * money: spend it to earn faster, or save it to stay on top.
 */
export function Shop({ view, act, unit, onClose }: { view: PlayerView; act: Act; unit: (n: number) => string; onClose: () => void }) {
  const juice = useJuice();
  const [busy, setBusy] = useState<string | null>(null);
  const shop = view.party.shop;
  const money = useCountUp(view.me.score);
  if (!shop) return null;

  const buy = async (id: string) => {
    setBusy(id);
    const v = await act({ action: "buy", item: id });
    setBusy(null);
    if (v) {
      sfx.buy();
      juice.confetti(30);
      juice.pop("Upgraded!", "#facc15");
    } else sfx.wrong();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Upgrade shop"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-3xl bg-gradient-to-b from-[#2a1b4a] to-[#1a1033] p-5 text-white shadow-2xl sm:rounded-3xl"
        style={{ animation: "jg-rise 0.25s ease-out" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black">🛒 Shop</h2>
          <span className="rounded-full bg-white/15 px-3 py-1 font-mono text-lg font-bold">{unit(money)}</span>
        </div>
        {ITEMS.map((it) => {
          const price = shop.prices[it.id];
          const level = it.id === "shield" ? shop.levels.shields : shop.levels[it.id];
          const afford = price !== null && view.me.score >= price;
          return (
            <button
              key={it.id}
              type="button"
              disabled={price === null || !afford || busy !== null}
              onClick={() => void buy(it.id)}
              className={`flex items-center gap-3 rounded-2xl p-3 text-left transition-transform active:scale-[0.98] ${afford ? "bg-white/15 hover:bg-white/20" : "bg-white/5 opacity-60"}`}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 text-2xl">{it.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{it.name}</span>
                <span className="block text-xs text-white/70">{it.desc}</span>
                {it.max > 0 ? (
                  <span className="mt-1 flex gap-1">
                    {Array.from({ length: it.max }, (_, i) => (
                      <span key={i} className={`h-2 w-5 rounded-full ${i < level ? "bg-[#facc15]" : "bg-white/20"}`} />
                    ))}
                  </span>
                ) : (
                  <span className="mt-1 block text-xs font-semibold text-[#facc15]">You have {level}</span>
                )}
              </span>
              <span className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-black ${price === null ? "bg-white/10" : afford ? "bg-[#facc15] text-[#2a1b4a]" : "bg-white/10"}`}>
                {busy === it.id ? "…" : price === null ? "MAX" : unit(price)}
              </span>
            </button>
          );
        })}
        <button type="button" onClick={onClose} className="mt-1 h-12 rounded-full bg-white font-black text-[#2a1b4a]">
          Back to the game
        </button>
      </div>
    </div>
  );
}

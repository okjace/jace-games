"use client";

import { useEffect, useRef, useState } from "react";
import type { Catch } from "@/lib/live/party";
import type { PartyProps } from "./shared";

/**
 * Lake Frenzy: every right answer (or tap, with questions off) is a cast,
 * and the server decides what bites. A frenzy doubles your next three
 * catches; a storm cloud halves everyone else's next one.
 */
const RARITY: Record<string, string> = {
  Minnow: "Common",
  Sunfish: "Common",
  Puffer: "Uncommon",
  Squid: "Rare",
  "Old Turtle": "Rare",
  "Lake Shark": "Epic",
  "Legendary Whale": "Legendary",
};
const RARITY_COLOR: Record<string, string> = { Common: "#8b919c", Uncommon: "#3ddc84", Rare: "#38bdf8", Epic: "#a78bfa", Legendary: "#facc15" };

export function LakeFrenzy({ view, earn }: PartyProps) {
  const [reveal, setReveal] = useState<Catch | null>(null);
  const [casting, setCasting] = useState(false);
  const p = view.party;
  const last = view.last;

  // Show the catch that just came in (from an answer or a tap), after a short cast.
  const latest = last?.kind === "catch" ? (last.catch as Catch) : null;
  const latestKey = latest ? `${view.me.answered}-${latest.name}-${latest.weight}` : "";
  const shown = useRef(latestKey); // don't replay the catch you already had when the page loaded
  useEffect(() => {
    if (!latest || latestKey === shown.current) return;
    shown.current = latestKey;
    setCasting(true);
    const t = setTimeout(() => {
      setCasting(false);
      setReveal(latest);
    }, 900);
    return () => clearTimeout(t);
    // latestKey identifies the catch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestKey]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-36 overflow-hidden rounded-2xl" style={{ background: "linear-gradient(#7dd3fc, #0369a1)" }}>
        <span className="absolute left-4 top-3 text-3xl">🌲</span>
        <span className="absolute right-6 top-2 text-2xl">☁️</span>
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-4xl">{casting ? "🎣" : "🛶"}</span>
        {casting && <span className="absolute bottom-10 left-[58%] animate-bounce text-2xl">🔴</span>}
        {(p.frenzy ?? 0) > 0 && <span className="absolute right-3 bottom-3 rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-sky-700">🫧 Frenzy ×2 ({p.frenzy} left)</span>}
        {p.stormed && <span className="absolute left-3 bottom-3 rounded-full bg-neutral-800/90 px-2 py-0.5 text-xs font-bold text-white">⛈️ Stormy: next catch halved</span>}
      </div>

      {reveal ? (
        <div className="animate-pop flex flex-col items-center gap-2 rounded-2xl border border-line bg-panel p-5 text-center">
          <span className="text-6xl">{reveal.icon}</span>
          <p className="text-xl font-bold">{reveal.name}</p>
          {reveal.kind === "fish" ? (
            <>
              <p className="text-lg">{reveal.weight} lb</p>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: RARITY_COLOR[RARITY[reveal.name] ?? "Common"] }}>
                {RARITY[reveal.name] ?? "Common"}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">
              {reveal.kind === "frenzy" ? "Your next 3 catches are doubled!" : reveal.kind === "storm" ? "Everyone else's next catch is halved!" : "Just junk this time."}
            </p>
          )}
          <button type="button" autoFocus onClick={() => setReveal(null)} className="mt-2 h-11 rounded-full bg-accent px-6 font-semibold text-on-accent">
            Cast again
          </button>
        </div>
      ) : casting ? (
        <p className="py-6 text-center text-muted">Something&apos;s biting…</p>
      ) : (
        earn
      )}

      {(p.catches ?? []).length > 0 && (
        <div className="rounded-2xl border border-line bg-panel p-3">
          <p className="mb-2 text-xs font-semibold text-muted">Recent catches</p>
          <div className="flex flex-wrap gap-2">
            {(p.catches ?? []).map((c, i) => (
              <span key={i} className="flex items-center gap-1 rounded-full bg-foreground/[.06] px-2 py-0.5 text-sm" title={c.name}>
                {c.icon} {c.kind === "fish" ? `${c.weight} lb` : c.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useJuice } from "../fx/Juice";
import { sfx } from "../fx/sfx";
import type { StageProps } from "./index";

/**
 * Gold Rush: every right answer (or dig) brings three chests. Pick one: it
 * might be gold, double your gold, a steal from someone else, a swap, a
 * loss, or nothing. What's inside was decided on the server when the
 * chests appeared.
 */

const OUTCOME: Record<string, { icon: string; color: string; title: (l: Record<string, unknown>) => string }> = {
  gain: { icon: "💰", color: "#facc15", title: (l) => `+${l.amount} gold!` },
  double: { icon: "✨", color: "#fde047", title: (l) => `DOUBLE! +${l.amount} gold` },
  steal: { icon: "🦝", color: "#a78bfa", title: (l) => `You stole ${l.amount} from ${l.target}!` },
  swap: { icon: "🔄", color: "#38bdf8", title: (l) => `Swapped gold with ${l.target}!` },
  lose: { icon: "💸", color: "#f87171", title: (l) => `Lost ${Math.abs(Number(l.amount))} gold` },
  nothing: { icon: "🫥", color: "#94a3b8", title: () => "Empty chest!" },
};

export function GoldRush({ view, act, busy, earn }: StageProps) {
  const juice = useJuice();
  const [opening, setOpening] = useState<number | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const pick = async (i: number) => {
    setOpening(i);
    sfx.tap();
    await new Promise((r) => setTimeout(r, 650)); // a little suspense
    const v = await act({ action: "pick", chest: i });
    setOpening(null);
    if (!v?.last) return;
    const l = v.last;
    setResult(l);
    const kind = String(l.chest);
    if (kind === "gain" || kind === "double") {
      sfx.open();
      setTimeout(() => sfx.cash(), 200);
      juice.pop(OUTCOME[kind].title(l), "#facc15");
      if (kind === "double") juice.confetti(60);
    } else if (kind === "steal" || kind === "swap") {
      sfx.hack();
      juice.flash("rgba(167,139,250,0.35)");
    } else if (kind === "lose") {
      sfx.wrong();
      juice.shake();
    } else sfx.whoosh();
  };

  if (result) {
    const kind = String(result.chest);
    const o = OUTCOME[kind] ?? OUTCOME.gain;
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-white/10 p-6 text-center backdrop-blur" style={{ animation: "jg-rise 0.3s ease-out" }}>
        <span className="text-7xl" style={{ animation: "jg-wiggle 0.5s ease-in-out 2" }}>
          {o.icon}
        </span>
        <p className="text-2xl font-black" style={{ color: o.color }}>
          {o.title(result)}
        </p>
        {typeof result.note === "string" && <p className="text-sm text-white/80">{result.note}</p>}
        <button type="button" autoFocus onClick={() => setResult(null)} className="h-12 rounded-full bg-[#facc15] px-8 font-black text-[#2b1462] shadow-[0_4px_0_rgba(0,0,0,0.3)] active:translate-y-1">
          Keep going
        </button>
      </div>
    );
  }

  if (view.chests !== null) {
    return (
      <div className="flex flex-col items-center gap-4 py-2">
        <p className="text-2xl font-black drop-shadow">Pick a chest!</p>
        <div className="flex gap-3">
          {Array.from({ length: view.chests }, (_, i) => (
            <button
              key={i}
              type="button"
              disabled={busy || opening !== null}
              onClick={() => void pick(i)}
              aria-label={`Chest ${i + 1}`}
              className={`transition-transform hover:-translate-y-1 active:scale-95 ${opening === i ? "animate-[jg-wiggle_0.15s_ease-in-out_infinite]" : opening !== null ? "opacity-40" : ""}`}
              style={{ animation: opening === null ? `jg-bob 1.6s ease-in-out ${i * 0.2}s infinite` : undefined }}
            >
              <Chest glowing={opening === i} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return <>{earn}</>;
}

/** A treasure chest drawn with CSS. */
function Chest({ glowing }: { glowing: boolean }) {
  return (
    <span className="relative block h-24 w-24 sm:h-28 sm:w-28" style={{ animation: glowing ? "jg-glow 0.6s ease-in-out infinite" : undefined, borderRadius: 16 }}>
      <span className="absolute inset-x-1 top-2 h-9 rounded-t-[40px] border-4 border-[#5b3410] bg-gradient-to-b from-[#c47a2c] to-[#9a5a1c]" />
      <span className="absolute inset-x-1 bottom-1 top-10 rounded-b-xl border-4 border-[#5b3410] bg-gradient-to-b from-[#b06a24] to-[#7c4614]" />
      <span className="absolute inset-x-1 top-[38px] h-2 bg-[#facc15]" />
      <span className="absolute left-1/2 top-[34px] h-6 w-5 -translate-x-1/2 rounded-md border-2 border-[#5b3410] bg-[#facc15]" />
    </span>
  );
}

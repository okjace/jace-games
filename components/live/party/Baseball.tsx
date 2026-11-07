"use client";

import { useState } from "react";
import { useJuice } from "../fx/Juice";
import { sfx } from "../fx/sfx";
import type { StageProps } from "./index";

/**
 * Home Run Derby: every right answer (or tap) puts you up to bat. Press HIT
 * and the ball's in play: most swings are hits, and an answer streak makes
 * home runs likelier. Wrong answers are strikes; three strikes is an out,
 * and three outs end the inning. The server decides every hit and counts
 * the runs.
 */

const PLAY_TEXT: Record<string, { text: string; emoji: string; color: string; good: boolean }> = {
  homer: { text: "HOME RUN!", emoji: "🎆", color: "#facc15", good: true },
  triple: { text: "TRIPLE!", emoji: "🔥", color: "#fb923c", good: true },
  double: { text: "DOUBLE!", emoji: "💥", color: "#4ade80", good: true },
  single: { text: "SINGLE!", emoji: "⚾", color: "#38bdf8", good: true },
  flyout: { text: "Caught! Fly out", emoji: "🧤", color: "#e2e8f0", good: false },
  groundout: { text: "Ground out", emoji: "🧤", color: "#e2e8f0", good: false },
};

export function Baseball({ view, act, busy, earn }: StageProps) {
  const juice = useJuice();
  const ball = view.party.ball;
  const atBat = !!ball?.pitch;
  const [banner, setBanner] = useState<{ play: string; runs: number; inningOver: boolean } | null>(null);
  const [swinging, setSwinging] = useState(false);

  const hit = async () => {
    if (swinging) return;
    setSwinging(true);
    sfx.whoosh();
    const v = await act({ action: "swing" });
    setSwinging(false);
    const last = v?.last;
    if (!last || last.kind !== "play") return;
    const play = String(last.play);
    const runs = Number(last.runs) || 0;
    setBanner({ play, runs, inningOver: !!last.inningOver });
    if (play === "homer") {
      sfx.boom();
      setTimeout(() => sfx.levelUp(), 200);
      juice.confetti(140);
      juice.flash("rgba(250,204,21,0.4)");
    } else if (PLAY_TEXT[play]?.good) {
      sfx.boom();
      sfx.cash();
    } else {
      sfx.wrong();
      juice.shake();
    }
    if (runs > 0) juice.pop(`+${runs} run${runs === 1 ? "" : "s"}`, "#facc15");
  };

  const field = ball && (
    <div className="flex items-center justify-between rounded-3xl bg-black/25 px-4 py-3 backdrop-blur">
      <MiniDiamond bases={ball.bases} />
      <Count label="Inning" value={<span className="text-2xl font-black">{ball.inning}</span>} />
      <Count label="Strikes" value={<Dots n={ball.strikes ?? 0} of={2} color="bg-amber-400" />} />
      <Count label="Outs" value={<Dots n={ball.outs} of={3} color="bg-red-500" />} />
    </div>
  );

  // A wrong answer just happened: say it was a strike (or the out).
  const lastPlay = view.last?.play;
  const struck = !atBat && !banner && (lastPlay === "strike" || lastPlay === "strikeout") && view.last?.kind === "answer";

  if (banner) {
    const p = PLAY_TEXT[banner.play] ?? PLAY_TEXT.single;
    return (
      <div className="flex flex-col gap-3">
        {field}
        <div className="flex flex-col items-center gap-2 rounded-3xl bg-white/10 p-6 text-center backdrop-blur" style={{ animation: "jg-rise 0.25s ease-out" }}>
          <p className="text-6xl" style={{ animation: "jg-zoom 0.6s ease-out" }}>
            {p.emoji}
          </p>
          <p className="text-4xl font-black drop-shadow" style={{ color: p.color }}>
            {p.text}
          </p>
          {banner.runs > 0 && <p className="text-xl font-black text-[#facc15]">+{banner.runs} run{banner.runs === 1 ? "" : "s"} scored!</p>}
          {banner.inningOver && <p className="font-bold text-white/80">Three outs: on to the next inning, bases cleared.</p>}
          <button type="button" autoFocus onClick={() => setBanner(null)} className="mt-2 h-12 rounded-full bg-white px-8 font-black text-green-800 shadow-[0_4px_0_rgba(0,0,0,0.25)] active:translate-y-1">
            Next batter
          </button>
        </div>
      </div>
    );
  }

  if (atBat) {
    return (
      <div className="flex flex-col gap-3">
        {field}
        <div className="flex flex-col items-center gap-3 py-4">
          <p className="text-lg font-black uppercase tracking-widest text-white/90">You&apos;re up to bat!</p>
          <button
            type="button"
            autoFocus
            disabled={busy || swinging}
            onClick={hit}
            className="flex h-48 w-48 flex-col items-center justify-center rounded-full bg-[#facc15] text-4xl font-black text-[#14532d] shadow-[0_12px_0_rgba(0,0,0,0.35)] transition-transform active:translate-y-2 active:shadow-[0_4px_0_rgba(0,0,0,0.35)] disabled:opacity-80"
            style={{ animation: swinging ? "jg-wiggle 0.3s ease-in-out infinite" : "jg-bob 2s ease-in-out infinite" }}
          >
            <span className="text-6xl">🏏</span>
            HIT!
          </button>
          <p className="text-sm font-semibold text-white/80">Most hits get on base. Answer streaks hit more home runs!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {field}
      {struck && (
        <p className="rounded-2xl bg-red-500/80 px-4 py-2 text-center font-black" style={{ animation: "jg-rise 0.25s ease-out" }}>
          {lastPlay === "strikeout" ? "Strike three, you're out!" : `Strike ${ball?.strikes ?? 1}! Get the next one right.`}
        </p>
      )}
      {earn}
    </div>
  );
}

function Count({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-white/70">{label}</p>
      <div className="flex h-8 items-center justify-center">{value}</div>
    </div>
  );
}

function Dots({ n, of, color }: { n: number; of: number; color: string }) {
  return (
    <span className="flex gap-1.5">
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={`h-4 w-4 rounded-full border-2 border-white ${i < n ? color : "bg-transparent"}`} />
      ))}
    </span>
  );
}

function MiniDiamond({ bases }: { bases: [boolean, boolean, boolean] }) {
  const base = (on: boolean) => `h-4 w-4 rotate-45 border-2 border-white ${on ? "bg-[#facc15]" : "bg-transparent"}`;
  return (
    <div className="relative h-14 w-14" aria-label={`Runners on: ${bases.map((b, i) => (b ? ["first", "second", "third"][i] : null)).filter(Boolean).join(", ") || "nobody"}`}>
      <span className={`absolute left-1/2 top-0 -translate-x-1/2 ${base(bases[1])}`} />
      <span className={`absolute right-0 top-1/2 -translate-y-1/2 ${base(bases[0])}`} />
      <span className={`absolute left-0 top-1/2 -translate-y-1/2 ${base(bases[2])}`} />
      <span className="absolute bottom-0 left-1/2 h-3 w-3 -translate-x-1/2 bg-white" />
    </div>
  );
}

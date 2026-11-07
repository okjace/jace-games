"use client";

import { useEffect, useState } from "react";
import type { PlayerView } from "@/lib/live/engine";
import { MODES, type LiveMode } from "@/lib/live/types";
import { Answer } from "../Answer";
import { CodeBreakers } from "./CodeBreakers";
import { GadgetFactory } from "./GadgetFactory";
import { LakeFrenzy } from "./LakeFrenzy";
import { SnackShack } from "./SnackShack";
import { TapButton, Toast, useEarn, type Act } from "./shared";
import { TowerSiege } from "./TowerSiege";

export const PARTY_MODES: LiveMode[] = ["tower", "snack", "factory", "fishing", "hack"];

const TAP_LABEL: Partial<Record<LiveMode, [string, string]>> = {
  tower: ["⚒️ MINE", "Each tap digs up a few coins."],
  snack: ["🥕 FORAGE", "Each tap brings in a little food."],
  factory: ["🪙 CRANK", "Each tap earns a few coins."],
  fishing: ["🎣 CAST", "Each tap is a cast."],
  hack: ["💻 MINE", "Each tap mines a few bits."],
};

const EARN_TEXT: Partial<Record<LiveMode, (v: PlayerView) => string>> = {
  tower: (v) => `+${v.last?.reward ?? ""} coins`,
  snack: (v) => `+${v.last?.reward ?? ""} food`,
  factory: (v) => `+${v.last?.reward ?? ""} coins`,
};

/** A party mode's screen: the mini-game, with an Earn panel to answer questions (or tap). */
export function PartyPlay({ view, busy, act }: { view: PlayerView; busy: boolean; act: Act }) {
  const { question, answer, tap, toast, say } = useEarn(view, act);
  const mode = view.mode;
  const left = useSecondsLeft(view.endsAt, view.serverNow);

  const afterEarn = (v: PlayerView | null) => {
    if (v?.last && (v.last.correct === true || v.last.kind === "tap") && EARN_TEXT[mode]) say(EARN_TEXT[mode]!(v), true);
  };

  const [label, sub] = TAP_LABEL[mode] ?? ["TAP!", ""];
  const earn = view.noSet ? (
    <TapButton label={label} sub={sub} disabled={busy} onTap={async () => afterEarn(await tap())} />
  ) : question ? (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <Answer key={`${view.me.answered}`} q={question} disabled={busy} onAnswer={async (a) => afterEarn(await answer(a))} />
    </div>
  ) : (
    <p className="animate-pulse py-6 text-center text-muted">Loading a question…</p>
  );

  const props = { view, busy, act, earn };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-xl bg-panel px-4 py-2 text-sm">
        <span className="font-semibold">
          {MODES[mode].icon} {MODES[mode].name}
        </span>
        <span className="font-mono font-bold tabular-nums">{left !== null ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : ""}</span>
      </div>
      {view.last?.kind === "stormed" && <p className="rounded-xl bg-neutral-800 px-3 py-2 text-center text-sm text-white">⛈️ {String(view.last.by)} sent a storm your way!</p>}
      {mode === "tower" && <TowerSiege {...props} />}
      {mode === "snack" && <SnackShack {...props} />}
      {mode === "factory" && <GadgetFactory {...props} />}
      {mode === "fishing" && <LakeFrenzy {...props} />}
      {mode === "hack" && <CodeBreakers {...props} />}
      <Toast toast={toast} />
      <ol className="flex flex-col gap-1 text-sm">
        {view.top.map((p, i) => (
          <li key={i} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${p.you ? "bg-accent/10 ring-1 ring-accent/30" : "bg-foreground/[.03]"}`}>
            <span className="w-5 font-mono text-muted">{i + 1}</span>
            <span className="flex-1 truncate">{p.name}</span>
            <span className="font-mono tabular-nums">{MODES[mode].unit(p.score)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function useSecondsLeft(endsAt: number | null, serverNow: number) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!endsAt) return;
    const skew = serverNow - Date.now();
    const tick = () => setLeft(Math.max(0, Math.ceil((endsAt - (Date.now() + skew)) / 1000)));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
    // Only re-sync the clock when the end time changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt]);
  return left;
}

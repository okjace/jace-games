"use client";

import { useEffect, useRef, useState } from "react";
import type { PlayerView } from "@/lib/live/engine";
import { MODES, type LiveMode } from "@/lib/live/types";
import { GameQuestion, type AnswerResult } from "../fx/GameQuestion";
import { Juice, MuteButton, useCountUp, useJuice } from "../fx/Juice";
import { sfx } from "../fx/sfx";
import { BananaBonanza } from "./BananaBonanza";
import { Baseball } from "./Baseball";
import { CodeBreakers } from "./CodeBreakers";
import { GadgetFactory } from "./GadgetFactory";
import { GoldRush } from "./GoldRush";
import { LakeFrenzy } from "./LakeFrenzy";
import { RocketRace } from "./RocketRace";
import { Shop } from "./Shop";
import { SnackShack } from "./SnackShack";
import type { Act } from "./shared";
import { FULLSCREEN_CLASS, FullscreenButton, useStageFullscreen } from "../fx/useStageFullscreen";
import { LiveAvatar, LiveName } from "../LiveAvatar";
import { Markdown } from "../Markdown";
import { RejoinPin } from "../PlayLive";
import { StudioMode } from "./StudioMode";
import { TowerSiege } from "./TowerSiege";

/** Every self-paced mode plays on this stage. */
export const PARTY_MODES: LiveMode[] = ["gold", "rocket", "tower", "snack", "factory", "fishing", "hack", "baseball", "custom", "banana"];

/** Each mode's look: background, accent, and its tap button with questions off. */
export const THEMES: Record<string, { bg: string; accent: string; tap: [string, string] }> = {
  gold: { bg: "radial-gradient(circle at 50% 0%, #6d3fd1 0%, #2b1462 55%, #160a36 100%)", accent: "#facc15", tap: ["💰 DIG", "Every dig opens a chest."] },
  rocket: { bg: "radial-gradient(circle at 50% 120%, #1e3a8a 0%, #0b1026 60%, #05060f 100%)", accent: "#38bdf8", tap: ["🔥 BOOST", "Every boost fires your rocket."] },
  tower: { bg: "linear-gradient(180deg, #2f6b3a 0%, #1d4527 100%)", accent: "#facc15", tap: ["⛏️ MINE", "Each tap digs up a few coins."] },
  snack: { bg: "linear-gradient(180deg, #ff9a5a 0%, #e8573c 100%)", accent: "#fff3c4", tap: ["🥕 FORAGE", "Each tap brings in a little food."] },
  factory: { bg: "linear-gradient(180deg, #3b4252 0%, #1f242e 100%)", accent: "#fbbf24", tap: ["🔩 CRANK", "Each tap earns a few coins."] },
  fishing: { bg: "linear-gradient(180deg, #38bdf8 0%, #0369a1 60%, #0c4a6e 100%)", accent: "#fde68a", tap: ["🎣 CAST", "Each tap is a cast."] },
  hack: { bg: "linear-gradient(180deg, #04130b 0%, #000 100%)", accent: "#3ddc84", tap: ["💻 MINE", "Each tap mines a few bits."] },
  baseball: { bg: "linear-gradient(180deg, #166534 0%, #14532d 70%, #052e16 100%)", accent: "#facc15", tap: ["⚾ PLAY BALL", "Each tap puts you up to bat."] },
  custom: { bg: "linear-gradient(180deg, #4338ca 0%, #1e1b4b 100%)", accent: "#a5f3fc", tap: ["🪙 EARN", "Each tap earns a few coins."] },
  banana: { bg: "radial-gradient(circle at 50% 0%, #fde047 0%, #f59e0b 55%, #b45309 100%)", accent: "#fef08a", tap: ["🍌 PEEL", "Each peel is a random banana event!"] },
};

const REWARD_TEXT: Partial<Record<LiveMode, (v: PlayerView) => string | null>> = {
  tower: (v) => (v.last?.reward ? `+${v.last.reward} 🪙` : null),
  snack: (v) => (v.last?.reward ? `+${v.last.reward} 🥫` : null),
  factory: (v) => (v.last?.reward ? `+${v.last.reward} 🪙` : null),
  custom: (v) => (v.last?.reward ? `+${v.last.reward} 🪙` : null),
  hack: (v) => (v.last?.kind === "bits" ? `+${v.last.amount} bits` : null),
  rocket: (v) => (typeof v.last?.boost === "number" ? `+${v.last.boost}%` : null),
};

type Feedback = { id: number; correct: boolean; prompt: string; yours: string; right: string[]; shielded: boolean };

/** Right or wrong, big and clear. Wrong answers show the right one and wait for a tap (or a few seconds). */
function FeedbackCard({ f, onDone, accent }: { f: Feedback; onDone: () => void; accent: string }) {
  if (f.correct) {
    return (
      <button type="button" onClick={onDone} className="flex flex-col items-center gap-1 rounded-3xl bg-green-500/90 px-6 py-8 text-center shadow-[0_6px_0_rgba(0,0,0,0.25)]" style={{ animation: "jg-rise 0.2s ease-out" }}>
        <span className="text-6xl" style={{ animation: "jg-zoom 0.5s ease-out" }}>
          ✅
        </span>
        <span className="text-3xl font-black">Correct!</span>
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-red-500/90 p-5 text-center shadow-[0_6px_0_rgba(0,0,0,0.25)]" role="alert" style={{ animation: "jg-rise 0.2s ease-out" }}>
      <span className="text-5xl">❌</span>
      <p className="text-3xl font-black">Not quite!</p>
      {f.shielded && <p className="font-bold">🛡️ Your shield saved your streak.</p>}
      <div className="rounded-2xl bg-black/25 p-3 text-left">
        <Markdown text={f.prompt} className="text-sm font-semibold text-white/80" />
        <p className="mt-2 text-sm">
          You said: <b className="line-through decoration-2">{f.yours}</b>
        </p>
        {f.right.length > 0 && (
          <p className="text-lg">
            Right answer: <b className="rounded bg-white px-1.5 text-green-700">{f.right.join(" / ")}</b>
          </p>
        )}
      </div>
      <button type="button" autoFocus onClick={onDone} className="h-12 rounded-full font-black text-black shadow-[0_4px_0_rgba(0,0,0,0.3)] active:translate-y-1" style={{ background: accent }}>
        Got it, next question →
      </button>
    </div>
  );
}

export type StageProps = {
  view: PlayerView;
  busy: boolean;
  act: Act;
  /** The earn panel: a question, or the tap button with questions off. */
  earn: React.ReactNode;
  /** True while this mode wants the earn panel hidden (a chest to pick, a hack to finish…). */
  setEarnHidden?: (hidden: boolean) => void;
};

export function PartyPlay(props: { view: PlayerView; busy: boolean; act: Act }) {
  return (
    <Juice>
      <Stage {...props} />
    </Juice>
  );
}

function Stage({ view, busy, act }: { view: PlayerView; busy: boolean; act: Act }) {
  const juice = useJuice();
  const mode = view.mode;
  const theme = THEMES[mode] ?? THEMES.gold;
  const def = MODES[mode];
  const left = useSecondsLeft(view.endsAt, view.serverNow);
  const score = useCountUp(view.me.score);
  const [shopOpen, setShopOpen] = useState(false);
  const fetching = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const full = useStageFullscreen(stageRef);

  // Keep the next question ready (with questions on).
  const needsQuestion = !view.noSet && !view.selfQuestion && view.status === "playing" && !(mode === "hack" && !view.party.password) && view.chests === null;
  useEffect(() => {
    if (!needsQuestion || fetching.current) return;
    fetching.current = true;
    void act({ action: "next" }).finally(() => (fetching.current = false));
  }, [needsQuestion, act]);

  // Someone else did something to you.
  const lastKind = view.last?.kind;
  const lastKey = `${lastKind}-${view.last?.by}-${view.last?.amount}`;
  const seenLast = useRef(lastKey);
  useEffect(() => {
    if (lastKey === seenLast.current) return;
    seenLast.current = lastKey;
    if (lastKind === "robbed" || lastKind === "hacked" || lastKind === "monkeyed") {
      sfx.alarm();
      juice.flash("rgba(229,72,77,0.45)");
      juice.shake();
    } else if (lastKind === "swapped" || lastKind === "stormed") {
      sfx.whoosh();
      juice.shake();
    }
  }, [lastKey, lastKind, juice]);

  const celebrate = (v: PlayerView | null) => {
    if (!v) return;
    const text = REWARD_TEXT[mode]?.(v);
    if (text) {
      sfx.coin();
      juice.pop(text, theme.accent);
    }
  };

  // What happened with the last answer, shown before the next question.
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), feedback.correct ? 1100 : 6000);
    return () => clearTimeout(t);
  }, [feedback]);

  const answer = async (a: number | string): Promise<AnswerResult> => {
    const q = view.selfQuestion;
    const v = await act({ action: "answer", answer: a });
    if (!v) return null;
    const last = v.last ?? {};
    const correct = last.correct !== false;
    if (q) {
      const yours = typeof a === "number" && q.choices ? (q.choices[a] ?? "?") : String(a);
      setFeedback({ id: Date.now(), correct, prompt: q.prompt, yours, right: Array.isArray(last.right) ? (last.right as string[]) : [], shielded: !!last.shielded });
    }
    if (correct) setTimeout(() => celebrate(v), 250);
    else if (last.shielded) juice.pop("🛡️ Streak saved!", "#facc15");
    return { correct, right: Array.isArray(last.right) ? (last.right as string[]) : undefined };
  };

  const [tapLabel, tapSub] = theme.tap;
  const earn = feedback ? (
    <FeedbackCard f={feedback} onDone={() => setFeedback(null)} accent={theme.accent} />
  ) : view.noSet ? (
    <div className="flex flex-col items-center gap-2 py-6">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          sfx.tap();
          celebrate(await act({ action: "tap" }));
        }}
        className="flex h-40 w-40 items-center justify-center rounded-full text-2xl font-black text-black shadow-[0_10px_0_rgba(0,0,0,0.35)] transition-transform active:translate-y-2 active:shadow-[0_2px_0_rgba(0,0,0,0.35)] disabled:opacity-70"
        style={{ background: theme.accent, animation: "jg-bob 2s ease-in-out infinite" }}
      >
        {tapLabel}
      </button>
      <p className="text-sm font-semibold text-white/80">{tapSub}</p>
    </div>
  ) : view.selfQuestion ? (
    <GameQuestion key={`${view.me.answered}`} q={view.selfQuestion} streak={view.me.streak} onAnswer={answer} accent={theme.accent} />
  ) : (
    <p className="animate-pulse py-10 text-center font-semibold text-white/80">Loading a question…</p>
  );

  const stageProps: StageProps = { view, busy, act, earn };

  return (
    <div
      ref={stageRef}
      className={`relative -mx-4 -mt-6 min-h-[calc(100vh-4rem)] px-4 pb-10 pt-4 text-white sm:-mx-6 sm:-mt-8 sm:px-6 ${full.on ? FULLSCREEN_CLASS : ""}`}
      style={{ background: theme.bg }}
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        {/* HUD */}
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-black/25 py-1.5 pl-2 pr-4 backdrop-blur">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-xl">{def.icon}</span>
            <span className="truncate font-mono text-xl font-black tabular-nums">{def.unit(score)}</span>
          </div>
          {view.me.streak >= 2 && <span className="rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-3 py-2 text-sm font-black">🔥{view.me.streak}</span>}
          <span className="rounded-full bg-black/25 px-3 py-2 text-sm font-bold backdrop-blur">#{view.me.rank}</span>
          <span className={`rounded-full bg-black/25 px-3 py-2 font-mono text-sm font-bold tabular-nums backdrop-blur ${left !== null && left <= 10 ? "text-red-300" : ""}`}>
            {left !== null ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : ""}
          </span>
          {view.party.shop && (
            <button type="button" onClick={() => setShopOpen(true)} className="rounded-full px-3 py-2 text-sm font-black text-black shadow-[0_3px_0_rgba(0,0,0,0.3)]" style={{ background: theme.accent }}>
              🛒
            </button>
          )}
          <MuteButton />
          <FullscreenButton on={full.on} toggle={full.toggle} className="bg-black/25 backdrop-blur" />
          {view.solo && (
            <button
              type="button"
              onClick={() => confirm("End this game now? Your score so far counts.") && void act({ action: "solo", op: "end" })}
              title="End the game now"
              className="rounded-full bg-black/25 px-3 py-2 text-sm font-bold backdrop-blur hover:bg-black/40"
            >
              🏁 End
            </button>
          )}
        </div>

        {view.last?.kind === "robbed" && <Alert>🦝 {String(view.last.by)} stole {String(view.last.amount)} of your gold!</Alert>}
        {view.last?.kind === "swapped" && <Alert>🔄 {String(view.last.by)} swapped gold with you!</Alert>}
        {view.last?.kind === "stormed" && <Alert>⛈️ {String(view.last.by)} sent a storm your way: your next catch is halved.</Alert>}
        {view.last?.kind === "monkeyed" && <Alert>🐒 {String(view.last.by)}&apos;s monkey stole {String(view.last.amount)} of your bananas!</Alert>}
        {view.last?.kind === "rained" && <Alert>🌧️🍌 {String(view.last.by)} made it rain: +{String(view.last.amount)} bananas!</Alert>}
        {view.last?.kind === "split" && <Alert>🍨 {String(view.last.by)} shared a banana split with you: +{String(view.last.amount)}!</Alert>}

        {mode === "gold" && <GoldRush {...stageProps} />}
        {mode === "rocket" && <RocketRace {...stageProps} />}
        {mode === "tower" && <TowerSiege {...stageProps} />}
        {mode === "snack" && <SnackShack {...stageProps} />}
        {mode === "factory" && <GadgetFactory {...stageProps} />}
        {mode === "fishing" && <LakeFrenzy {...stageProps} />}
        {mode === "hack" && <CodeBreakers {...stageProps} />}
        {mode === "baseball" && <Baseball {...stageProps} />}
        {mode === "custom" && <StudioMode {...stageProps} />}
        {mode === "banana" && <BananaBonanza {...stageProps} />}

        <RejoinPin code={view.code} small />
        <ol className="flex flex-col gap-1.5 rounded-3xl bg-black/25 p-3 text-sm backdrop-blur">
          {view.top.map((p, i) => (
            <li key={p.name} className={`flex items-center gap-2 rounded-xl px-3 py-1.5 transition-colors ${p.you ? "bg-white/20 font-bold" : ""}`}>
              <span className="w-6 text-center">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
              <LiveAvatar avatar={p.avatar} size={26} />
              <span className="flex-1 truncate">
                <LiveName name={p.name} avatar={p.avatar} />
              </span>
              <span className="font-mono tabular-nums">{def.unit(p.score)}</span>
            </li>
          ))}
        </ol>
      </div>
      {shopOpen && <Shop view={view} act={act} unit={def.unit} onClose={() => setShopOpen(false)} />}
    </div>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-red-500/90 px-4 py-2 text-center text-sm font-bold shadow-lg" style={{ animation: "jg-rise 0.25s ease-out" }}>{children}</p>;
}

function useSecondsLeft(endsAt: number | null, serverNow: number) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!endsAt) return;
    const skew = serverNow - Date.now();
    let warned = false;
    const tick = () => {
      const s = Math.max(0, Math.ceil((endsAt - (Date.now() + skew)) / 1000));
      setLeft(s);
      if (s <= 10 && s > 0 && !warned) {
        warned = true;
        sfx.countdown();
      }
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
    // Only re-sync the clock when the end time changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt]);
  return left;
}

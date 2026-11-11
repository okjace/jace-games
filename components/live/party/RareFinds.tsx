"use client";

import { useEffect, useRef, useState } from "react";
import { RARE_TIERS } from "@/lib/live/rare";
import { Markdown } from "../Markdown";
import { useJuice } from "../fx/Juice";
import { sfx } from "../fx/sfx";
import type { StageProps } from "./index";

/**
 * Rare Finds: name anything that fits the prompt; rarer answers score more.
 * 7 random prompts, 25 seconds each, as many guesses as you like. After each
 * prompt you see what you found and the rarest answers you could have given.
 */
export function RareFinds({ view, act, busy }: StageProps) {
  const juice = useJuice();
  const r = view.party.rare;
  const q = view.selfQuestion;
  const last = view.last?.kind === "rare" ? view.last : null;
  const miss = view.last?.kind === "rare-miss" ? view.last : null;
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // The 25-second clock (corrected for the server's time), worked out on each tick.
  const [left, setLeft] = useState(25_000);
  const skew = useRef(0);
  useEffect(() => {
    skew.current = view.serverNow - Date.now();
  }, [view.serverNow]);
  const endsAt = r?.endsAt ?? null;
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => setLeft(Math.max(0, endsAt - (Date.now() + skew.current)));
    const t = setInterval(tick, 200);
    const first = setTimeout(tick, 0);
    return () => {
      clearInterval(t);
      clearTimeout(first);
    };
  }, [endsAt]);

  // Out of time: move on (once per prompt).
  const skipped = useRef<number | null>(null);
  useEffect(() => {
    if (!q || !endsAt || left > 0 || skipped.current === endsAt) return;
    skipped.current = endsAt;
    void act({ action: "skip" });
  }, [q, endsAt, left, act]);

  // Sounds and effects for each result.
  const seen = useRef("");
  const key = last ? `${String(last.round)}-${String(last.answer)}-${String(last.points)}` : "";
  useEffect(() => {
    if (!last || key === seen.current) return;
    seen.current = key;
    const tier = Number(last.tier);
    if (tier >= 5) {
      sfx.levelUp();
      juice.confetti(150);
      juice.flash("rgba(56,189,248,0.45)");
    } else if (tier >= 3) {
      sfx.cash();
      juice.confetti(50);
    } else if (tier >= 1) sfx.correct();
    else sfx.wrong();
    if (Number(last.points) > 0) juice.pop(`+${String(last.points)}`, RARE_TIERS[tier]?.color ?? "#fff");
  }, [key, last, juice]);

  useEffect(() => {
    if (q) inputRef.current?.focus();
  }, [q]);

  if (!r) return null;

  const guess = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setText("");
    const v = await act({ action: "answer", answer: t });
    if (v?.last?.kind === "rare-miss") {
      sfx.wrong();
      juice.shake();
    }
  };

  // Finished all 7.
  if (r.done && !q) {
    return (
      <div className="flex flex-col gap-3">
        {last && <ResultCard last={last} />}
        <div className="rounded-3xl bg-black/25 p-6 text-center backdrop-blur">
          <p className="text-4xl">🏁</p>
          <p className="mt-1 text-2xl font-black">All {r.rounds} done!</p>
          <p className="text-3xl font-black">{view.me.score} pts</p>
          <p className="text-sm text-white/80">Waiting for everyone else to finish…</p>
        </div>
      </div>
    );
  }

  // Between prompts (or before the first).
  if (!q) {
    return (
      <div className="flex flex-col gap-3">
        {last ? (
          <ResultCard last={last} />
        ) : (
          <div className="rounded-3xl bg-black/25 p-6 text-center backdrop-blur">
            <p className="text-5xl">💎</p>
            <p className="mt-2 text-xl font-black">Find the rare answers</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-white/80">
              Each prompt has lots of right answers. Name any of them, but the rarer the answer, the more it&apos;s worth. {r.rounds} prompts, 25
              seconds each, guess as much as you like.
            </p>
            <TierKey />
          </div>
        )}
        <button
          type="button"
          autoFocus
          disabled={busy}
          onClick={() => void act({ action: "next" })}
          className="h-14 rounded-full bg-white text-lg font-black text-sky-900 shadow-[0_6px_0_rgba(0,0,0,0.25)] active:translate-y-1 disabled:opacity-60"
        >
          {r.round === 0 ? "Start" : `Next prompt (${r.round + 1}/${r.rounds}) →`}
        </button>
      </div>
    );
  }

  // A prompt in play.
  const pct = (left / 25_000) * 100;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm font-bold text-white/90">
        <span>
          Prompt {r.round}/{r.rounds}
        </span>
        <span className={`font-mono text-lg tabular-nums ${left < 6000 ? "text-red-300" : ""}`}>{Math.ceil(left / 1000)}s</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/30">
        <div className={`h-full rounded-full transition-[width] duration-200 ${left < 6000 ? "bg-red-400" : "bg-white"}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="rounded-3xl bg-white p-6 text-center text-neutral-900 shadow-[0_6px_0_rgba(0,0,0,0.18)]">
        <Markdown text={q.prompt} className="text-2xl font-extrabold leading-snug" />
        <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Rarer answers score more</p>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void guess();
        }}
      >
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 120))}
          placeholder="Type an answer…"
          aria-label="Your answer"
          autoComplete="off"
          className="h-14 min-w-0 flex-1 rounded-2xl border-4 border-white/70 bg-white px-4 text-xl font-bold text-neutral-900 outline-none focus:border-white"
        />
        <button type="submit" disabled={!text.trim() || busy} className="h-14 rounded-2xl bg-sky-400 px-5 text-lg font-black text-sky-950 disabled:opacity-60">
          Go
        </button>
      </form>
      {miss && r.guesses.length > 0 && (
        <p className="text-center text-sm font-semibold text-red-200">
          &ldquo;{String(miss.guess)}&rdquo; isn&apos;t on the list. Try another!
        </p>
      )}
      {r.guesses.length > 1 && <p className="text-center text-xs text-white/70">Tried: {r.guesses.join(", ")}</p>}
      <button type="button" onClick={() => void act({ action: "skip" })} disabled={busy} className="self-center text-sm text-white/70 underline">
        Give up on this one
      </button>
    </div>
  );
}

function TierKey() {
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-1.5 text-xs">
      {Object.entries(RARE_TIERS).map(([t, info]) => (
        <span key={t} className="rounded-full bg-black/25 px-2.5 py-1 font-bold" style={{ color: info.color }}>
          {info.icon} {info.name} {info.points}
        </span>
      ))}
    </div>
  );
}

function ResultCard({ last }: { last: Record<string, unknown> }) {
  const tier = Number(last.tier);
  const info = RARE_TIERS[tier];
  const examples = (last.examples as { answer: string; tier: number }[] | undefined) ?? [];
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl bg-black/30 p-5 text-center backdrop-blur" style={{ animation: "jg-zoom 0.4s ease-out" }}>
      <p className="text-sm font-semibold text-white/80">{String(last.prompt ?? "")}</p>
      {info ? (
        <>
          <span className="text-6xl">{info.icon}</span>
          <p className="text-3xl font-black" style={{ color: info.color }}>
            {info.name}!
          </p>
          <p className="text-lg">
            &ldquo;{String(last.answer)}&rdquo; · <b>+{String(last.points)}</b>
          </p>
        </>
      ) : (
        <>
          <span className="text-5xl">⏰</span>
          <p className="text-2xl font-black">{last.skipped ? "Skipped" : "Out of time"}</p>
        </>
      )}
      {examples.length > 0 && (
        <div className="mt-1 w-full rounded-2xl bg-black/25 p-3 text-left text-sm">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-white/70">Rarest answers</p>
          <ul className="flex flex-col gap-0.5">
            {examples.map((e) => (
              <li key={e.answer}>
                {RARE_TIERS[e.tier]?.icon} {e.answer} <span className="text-white/60">· {RARE_TIERS[e.tier]?.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

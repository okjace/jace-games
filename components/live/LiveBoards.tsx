"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Avatar } from "@/lib/live/locker";
import { MODES, type LiveMode } from "@/lib/live/types";
import { LiveAvatar } from "./LiveAvatar";
import { card } from "./ui";

type Details = {
  minutes: number | null;
  noSet: boolean;
  setTitle: string | null;
  questions: number;
  shuffle: boolean;
  players: number;
  place: number;
  correct: number;
  answered: number;
  streak: number;
  solo: boolean;
  host: string;
  mapTitle: string | null;
  playedSeconds: number | null;
  playedAt: string | null;
};
type Row = { name: string; best: number; avatar: Avatar | null; at: string; code: string | null; details: Details | null };

const length = (min: number | null) => {
  if (min === null) return "per question";
  if (min === 0) return "♾️ forever";
  const t = Math.round(min * 60);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  return [h && `${h} hr`, m && `${m} min`, sec && `${sec} sec`].filter(Boolean).join(" ") || "0 sec";
};
const lasted = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);
const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

/** The short line under a score: time limit, players, place, answers. */
function summary(d: Details): string {
  const bits = [`⏱ ${length(d.minutes)}`, d.solo ? "🎮 solo" : `👥 ${d.players} ${d.players === 1 ? "playa" : "playas"}`, `🏅 ${ordinal(d.place)} place`];
  if (d.answered > 0 && !d.noSet) bits.push(`✅ ${d.correct}/${d.answered}`);
  return bits.join(" · ");
}

/** Everything about the game a score came from. */
function DetailsCard({ d, code }: { d: Details; code: string | null }) {
  const acc = d.answered > 0 ? Math.round((d.correct / d.answered) * 100) : null;
  const items: [string, string][] = [
    ["⏱ time limit", length(d.minutes)],
    ["⌛ game lasted", d.playedSeconds !== null ? lasted(d.playedSeconds) : "?"],
    ["❓ questions", d.noSet ? "none (tap to earn)" : `${d.setTitle ?? "a set"} (${d.questions})`],
    ["🔀 shuffled", d.noSet ? "–" : d.shuffle ? "yes" : "no"],
    ["👥 playas", d.solo ? "solo (just them + bots)" : String(d.players)],
    ["🏅 place", `${ordinal(d.place)} of ${d.players}`],
    ["✅ right ansers", d.noSet ? "–" : `${d.correct} of ${d.answered}${acc !== null ? ` (${acc}%)` : ""}`],
    ["🔥 streak at the end", String(d.streak)],
    ["📺 hosted by", d.solo ? "solo game" : d.host],
  ];
  if (d.mapTitle) items.push(["🗺️ map", d.mapTitle]);
  if (d.playedAt) items.push(["📅 played", new Date(d.playedAt).toLocaleString()]);
  if (code) items.push(["🔢 game code", code]);
  return (
    <dl className="grid gap-x-4 gap-y-1.5 rounded-2xl bg-foreground/[.04] p-3 text-sm sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 truncate text-right font-semibold">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Global leaderboards: the best score per player for each Live mode (people choose to add theirs when a game ends). */
export function LiveBoards() {
  const params = useSearchParams();
  const router = useRouter();
  const modes: LiveMode[] = (Object.keys(MODES) as LiveMode[]).filter((m) => m !== "custom");
  const want = params.get("mode");
  const mode: LiveMode = want && modes.includes(want as LiveMode) ? (want as LiveMode) : "classic";
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/live/leaderboards?mode=${mode}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { rows: [] }))
      .then((d) => live && setRows(d.rows ?? []))
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [mode]);
  const def = MODES[mode];
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">🏆 leaderboards</h1>
        <p className="text-muted">the best of the best, for evry game mode. finish a game n hit &ldquo;yes pls&rdquo; to get on here!!</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {modes.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setRows(null);
              setOpen(null);
              router.replace(`/leaderboards?mode=${m}`, { scroll: false });
            }}
            aria-pressed={m === mode}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-transform hover:-translate-y-0.5 ${m === mode ? "bg-accent text-on-accent shadow" : "border border-line bg-panel hover:bg-accent/10"}`}
          >
            {MODES[m].icon} {MODES[m].name}
          </button>
        ))}
      </div>
      <section className={card}>
        <h2 className="mb-3 font-display text-2xl font-extrabold">
          {def.icon} {def.name}
        </h2>
        {rows === null ? (
          <div className="h-40 animate-pulse rounded-2xl bg-foreground/[.04]" />
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-muted">nobody&apos;s on this one yet 👀 be the frist!!</p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {rows.map((r, i) => (
              <li key={`${r.name}-${i}`} className={`flex flex-col gap-2 rounded-2xl px-3 py-2 ${i < 3 ? "bg-accent/10" : "odd:bg-foreground/[.03]"}`}>
                <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="flex w-full items-center gap-3 text-left">
                  <span className="w-8 text-center text-lg font-black">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
                  <LiveAvatar avatar={r.avatar} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{r.name}</span>
                    <span className="block truncate text-xs text-muted">{r.details ? summary(r.details) : `📅 ${new Date(r.at).toLocaleDateString()}`}</span>
                  </span>
                  <span className="font-mono font-bold tabular-nums">{def.unit(r.best)}</span>
                  <span className={`text-muted transition-transform ${open === i ? "rotate-90" : ""}`} aria-hidden="true">
                    ›
                  </span>
                </button>
                {open === i &&
                  (r.details ? (
                    <DetailsCard d={r.details} code={r.code} />
                  ) : (
                    <p className="rounded-2xl bg-foreground/[.04] p-3 text-sm text-muted">this score is from before we saved game info 🤷 (got it {new Date(r.at).toLocaleString()})</p>
                  ))}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

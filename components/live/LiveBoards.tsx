"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Avatar } from "@/lib/live/locker";
import { MODES, type LiveMode } from "@/lib/live/types";
import { LiveAvatar } from "./LiveAvatar";
import { card } from "./ui";

type Row = { name: string; best: number; avatar: Avatar | null; at: string };

/** Global leaderboards: the best score per player for each Live mode (people choose to add theirs when a game ends). */
export function LiveBoards() {
  const params = useSearchParams();
  const router = useRouter();
  const modes: LiveMode[] = (Object.keys(MODES) as LiveMode[]).filter((m) => m !== "custom");
  const want = params.get("mode");
  const mode: LiveMode = want && modes.includes(want as LiveMode) ? (want as LiveMode) : "classic";
  const [rows, setRows] = useState<Row[] | null>(null);
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
              <li key={`${r.name}-${i}`} className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${i < 3 ? "bg-accent/10" : "odd:bg-foreground/[.03]"}`}>
                <span className="w-8 text-center text-lg font-black">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
                <LiveAvatar avatar={r.avatar} size={32} />
                <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
                <span className="font-mono font-bold tabular-nums">{def.unit(r.best)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

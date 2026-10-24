"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GAMES, isNewGame } from "@/lib/games";
import { useBests } from "@/lib/useBest";

type Filter = "all" | "solo" | "multi";

export function GameGrid() {
  const bests = useBests();
  const [filter, setFilter] = useState<Filter>("all");
  const shown = GAMES.filter((g) => (filter === "solo" ? g.solo !== false : filter === "multi" ? !!g.multiplayer : true));
  // "New" depends on today's date, so work it out in the browser.
  const [now, setNow] = useState<number | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setNow(Date.now()), []);

  return (
    <div className="flex flex-col gap-4">
    <div className="flex flex-wrap gap-2" role="group" aria-label="Show games">
      {(
        [
          ["all", "All games"],
          ["solo", "Solo"],
          ["multi", "👥 Multiplayer"],
        ] as const
      ).map(([f, label]) => (
        <button
          key={f}
          type="button"
          aria-pressed={filter === f}
          onClick={() => setFilter(f)}
          className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
            filter === f ? "border-accent bg-accent text-on-accent" : "border-line bg-panel text-muted hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
    <ul className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3">
      {shown.map((game) => {
        const best = bests[game.id];
        return (
          <li key={game.id}>
            <Link
              href={`/play/${game.id}`}
              className="group flex h-full flex-col gap-4 rounded-2xl border border-line bg-panel p-5 transition-colors hover:border-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground/[.05] text-3xl transition-transform group-hover:scale-105"
                >
                  {game.icon}
                </span>
                <span className="flex gap-1.5">
                  {game.multiplayer && (
                    <span title="Play with friends" className="rounded-full border border-line px-2 py-0.5 text-xs font-medium text-muted">
                      👥 {game.multiplayer.min === game.multiplayer.max ? game.multiplayer.max : `${game.multiplayer.min}–${game.multiplayer.max}`}
                    </span>
                  )}
                  {now !== null && isNewGame(game, now) && (
                    <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-on-accent">New</span>
                  )}
                </span>
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold">{game.name}</h2>
                <p className="mt-1 text-sm text-muted">{game.description}</p>
              </div>
              <div className="flex items-center justify-between border-t border-line pt-3 text-sm">
                {game.solo === false ? (
                  <>
                    <span className="text-muted">Multiplayer</span>
                    <span className="font-semibold text-muted">Online or pass & play</span>
                  </>
                ) : (
                  <>
                    <span className="text-muted">Your best</span>
                    <span className={`font-semibold tabular-nums ${best ? "text-accent" : "text-muted"}`}>
                      {best ? game.format(best.score) : "Not played yet"}
                    </span>
                  </>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
    </div>
  );
}

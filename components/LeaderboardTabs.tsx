"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Leaderboard } from "@/components/Leaderboard";
import { GAMES, getGame } from "@/lib/games";

export function LeaderboardTabs({ initial }: { initial: string }) {
  const [active, setActive] = useState(initial);
  const game = getGame(active) ?? GAMES[0];
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (id: string) => {
    setActive(id);
    window.history.replaceState(null, "", `/leaderboards?game=${id}`);
  };

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const j = (i + d + GAMES.length) % GAMES.length;
    select(GAMES[j].id);
    tabRefs.current[j]?.focus();
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Games" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {GAMES.map((g, i) => (
          <button
            key={g.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${g.id}`}
            aria-selected={g.id === game.id}
            aria-controls="leaderboard-panel"
            tabIndex={g.id === game.id ? 0 : -1}
            onClick={() => select(g.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              g.id === game.id
                ? "border-accent bg-accent text-on-accent"
                : "border-line bg-panel text-muted hover:text-foreground"
            }`}
          >
            <span aria-hidden="true">{g.icon}</span>
            {g.name}
          </button>
        ))}
      </div>
      <section
        id="leaderboard-panel"
        role="tabpanel"
        aria-labelledby={`tab-${game.id}`}
        className="rounded-2xl border border-line bg-panel p-5"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">
              {game.icon} {game.name}
            </h2>
            <p className="text-xs text-muted">{game.better === "higher" ? "Higher is better" : "Lower is better"} · top 50</p>
          </div>
          <Link
            href={`/play/${game.id}`}
            className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
          >
            Play
          </Link>
        </div>
        <Leaderboard key={game.id} game={game} limit={50} />
      </section>
    </div>
  );
}

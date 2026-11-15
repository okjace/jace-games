"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MODES, type LiveMode } from "@/lib/live/types";
import { card, primary, secondary } from "./ui";

type OpenGame = { code: string; mode: LiveMode; setTitle: string | null; hostName: string; status: string; players: number };

/**
 * Live games their hosts listed publicly: join one right now. Refreshes every
 * 10 seconds. `embedded` drops the page heading (for the Join and home pages).
 */
export function LiveGames({ embedded = false, limit }: { embedded?: boolean; limit?: number }) {
  const [games, setGames] = useState<OpenGame[] | null>(null);
  useEffect(() => {
    const load = () =>
      fetch("/api/live/public", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { games: [] }))
        .then((d) => setGames(d.games ?? []))
        .catch(() => setGames((g) => g ?? []));
    void load();
    const t = setInterval(() => document.visibilityState === "visible" && void load(), 10_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className={embedded ? "flex flex-col gap-5" : "mx-auto flex max-w-4xl flex-col gap-5"}>
      {!embedded && (
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">🌍 join a live game</h1>
          <p className="text-muted">games ppl r hosting rn that anyone can join. this list updates by itself (magic).</p>
        </div>
      )}
      {games === null ? (
        <p className="animate-pulse text-muted">Looking for games…</p>
      ) : games.length === 0 ? (
        <div className={`${card} flex flex-col items-center gap-3 py-10 text-center`}>
          <p className="text-5xl">🛋️</p>
          <p className="text-lg font-semibold">no public games rn 🛋️</p>
          <p className="max-w-md text-sm text-muted">
            When someone hosts a game and turns on <b>🌍 List on Discover</b>, it shows up here. check back soon, or start one urself!
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/live/host/new" className={primary}>
              Host a game
            </Link>
            <Link href="/live/host/new?solo=1" className={secondary}>
              🎮 Play solo
            </Link>
          </div>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {(limit ? games.slice(0, limit) : games).map((g) => (
            <li key={g.code} className={`${card} flex items-center gap-3`}>
              <span className="text-4xl">{MODES[g.mode]?.icon ?? "🎮"}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{g.setTitle ?? MODES[g.mode]?.name ?? "Live game"}</span>
                <span className="block truncate text-sm text-muted">
                  {MODES[g.mode]?.name} · hosted by {g.hostName}
                </span>
                <span className="block text-xs text-muted">
                  {g.players} playing · {g.status === "lobby" ? "starting soon" : "in progress"}
                </span>
              </span>
              <Link href={`/live/watch/${g.code}`} title="Watch without playing" className="flex h-10 items-center rounded-full border border-line px-4 text-sm font-semibold hover:bg-accent/10">
                👀 Watch
              </Link>
              <Link href={`/live/play/${g.code}`} className={`${primary} h-10 px-5`}>
                Join
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

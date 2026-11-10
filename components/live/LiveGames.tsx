"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MODES, type LiveMode } from "@/lib/live/types";
import { card, primary, secondary } from "./ui";

type OpenGame = { code: string; mode: LiveMode; setTitle: string | null; hostName: string; status: string; players: number };

/** /live/games: Live games their hosts listed publicly. Join one right now. Refreshes every 10 seconds. */
export function LiveGames() {
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
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <div>
        <Link href="/live" className="text-sm text-muted hover:text-foreground">
          ← Live
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">🌍 Join a live game</h1>
        <p className="text-muted">Games people are hosting right now that anyone can join. This list updates by itself.</p>
      </div>
      {games === null ? (
        <p className="animate-pulse text-muted">Looking for games…</p>
      ) : games.length === 0 ? (
        <div className={`${card} flex flex-col items-center gap-3 py-10 text-center`}>
          <p className="text-5xl">🛋️</p>
          <p className="text-lg font-semibold">No public games right now</p>
          <p className="max-w-md text-sm text-muted">
            When someone hosts a game and turns on <b>🌍 List on Discover</b>, it shows up here. Check back soon, or start one yourself!
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
          {games.map((g) => (
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

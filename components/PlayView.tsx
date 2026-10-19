"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { GAME_COMPONENTS } from "@/components/games";
import { Leaderboard } from "@/components/Leaderboard";
import { useScores } from "@/components/ScoresProvider";
import { SyncStatus } from "@/components/SyncStatus";
import { getGame } from "@/lib/games";
import { timeAgo } from "@/lib/format";
import { bestOf } from "@/lib/useBest";

export function PlayView({ gameId }: { gameId: string }) {
  const game = getGame(gameId)!;
  const Game = GAME_COMPONENTS[game.id];
  const { history, record, user } = useScores();
  const [round, setRound] = useState(0);

  const mine = useMemo(() => history.filter((s) => s.game === game.id), [history, game.id]);
  const best = useMemo(() => bestOf(game, history), [game, history]);

  const onFinish = useCallback(
    (score: number, durationMs: number) => {
      record(game.id, score, durationMs);
      setRound((r) => r + 1);
    },
    [game.id, record],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            aria-label="All games"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-foreground/[.06] hover:text-foreground"
          >
            ←
          </Link>
          <span aria-hidden="true" className="text-3xl">
            {game.icon}
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{game.name}</h1>
            <p className="text-sm text-muted">{game.description}</p>
          </div>
        </div>
        <SyncStatus />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-2xl border border-line bg-panel/40 p-3 sm:p-6" aria-label={`${game.name} game`}>
          {Game ? <Game onFinish={onFinish} best={best?.score ?? null} /> : <p>This game is missing its component.</p>}
        </section>

        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl border border-line bg-panel p-5">
            <p className="text-sm text-muted">Personal best</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-accent">{best ? game.format(best.score) : "—"}</p>
            <p className="mt-1 text-xs text-muted">
              {best ? timeAgo(best.createdAt) : game.better === "higher" ? "Higher is better" : "Lower is better"}
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-panel p-5">
            <h2 className="mb-3 text-sm font-semibold">Recent scores</h2>
            {mine.length === 0 ? (
              <p className="text-sm text-muted">No scores yet — play a round!</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {mine.slice(0, 8).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 odd:bg-foreground/[.03]">
                    <span className="font-medium tabular-nums">
                      {game.format(s.score)}
                      {best?.id === s.id && <span className="ml-1.5 text-xs text-accent">best</span>}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      {s.localOnly && user && (
                        <span title="Saved on this device, waiting to upload" aria-label="Waiting to upload">
                          ⏳
                        </span>
                      )}
                      {timeAgo(s.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-panel p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Top 10</h2>
              <Link href={`/leaderboards?game=${game.id}`} className="text-xs font-medium text-accent hover:underline">
                Full leaderboard
              </Link>
            </div>
            <Leaderboard game={game} limit={10} refreshKey={round} />
          </div>
        </aside>
      </div>
    </div>
  );
}

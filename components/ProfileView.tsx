"use client";

import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { useScores } from "@/components/ScoresProvider";
import { signInHref } from "@/components/site/SiteHeader";
import { SyncStatus } from "@/components/SyncStatus";
import { MultiplayerRecord } from "@/components/MultiplayerRecord";
import { SOLO_GAMES } from "@/lib/games";
import { timeAgo } from "@/lib/format";
import { useBests } from "@/lib/useBest";

export function ProfileView() {
  const { user, history, pendingCount } = useScores();
  const bests = useBests();

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-6 sm:flex-row sm:items-center sm:justify-between">
        {user ? (
          <div className="flex items-center gap-4">
            <Avatar name={user.username} src={user.picture} size={64} />
            <div className="flex flex-col gap-1.5">
              <h1 className="text-2xl font-bold tracking-tight">{user.username}</h1>
              <div>
                <SyncStatus />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold tracking-tight">Your scores</h1>
            <p className="text-sm text-muted">
              You&apos;re playing signed out, so scores are saved on this device only.
            </p>
          </div>
        )}
        {user ? (
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="h-10 rounded-full border border-line px-5 text-sm font-medium transition-colors hover:bg-foreground/[.05]"
            >
              Sign out
            </button>
          </form>
        ) : (
          <a
            href={signInHref("/profile")}
            className="inline-flex h-10 items-center justify-center rounded-full bg-accent px-5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
          >
            Sign in with Jace
          </a>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Best score per game</h2>
          <p className="text-xs text-muted">
            {history.length} score{history.length === 1 ? "" : "s"} in total
            {user && pendingCount > 0 ? ` · ${pendingCount} waiting to upload` : ""}
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {SOLO_GAMES.map((game) => {
            const best = bests[game.id];
            const plays = history.filter((s) => s.game === game.id).length;
            return (
              <li key={game.id}>
                <Link
                  href={`/play/${game.id}`}
                  className="flex items-center gap-4 rounded-2xl border border-line bg-panel p-4 transition-colors hover:border-accent/50"
                >
                  <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-xl bg-foreground/[.05] text-2xl">
                    {game.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{game.name}</p>
                    <p className="text-xs text-muted">
                      {plays ? `${plays} play${plays === 1 ? "" : "s"}${best ? ` · best ${timeAgo(best.createdAt)}` : ""}` : "Not played yet"}
                    </p>
                  </div>
                  <span className={`font-semibold tabular-nums ${best ? "text-accent" : "text-muted"}`}>
                    {best ? game.format(best.score) : "—"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
      {user && <MultiplayerRecord />}
    </div>
  );
}

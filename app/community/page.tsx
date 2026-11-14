import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { publishedGames } from "@/lib/studio/server";

export const metadata: Metadata = { title: "Community games", description: "live modes made by Jace players in the Studio. host one for ur room!!" };

export default async function CommunityPage() {
  await connection();
  const games = await publishedGames();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">💬 Community games</h1>
          <p className="mt-1 text-muted">live modes made by Jace players in the Studio. host one for ur room!!</p>
        </div>
        <Link
          href="/studio"
          className="inline-flex h-10 items-center justify-center rounded-full bg-accent px-5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
        >
          make a game
        </Link>
      </div>
      {games.length === 0 ? (
        <div className="rounded-2xl border border-line bg-panel p-6 text-center text-sm text-muted">no games yet. be the frist to publish one!</div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {games.map((g) => (
            <li key={g.id}>
              <div className="relative flex h-full flex-col gap-2 rounded-3xl border border-line bg-panel p-4 shadow-[0_10px_30px_-20px_rgba(30,20,10,0.3)] transition-colors hover:border-accent">
                {g.multiplayer && (
                  <span className="absolute right-3 top-3 rounded-full bg-foreground/[.06] px-2 py-0.5 text-xs" title={`${g.multiplayer.min}–${g.multiplayer.max} players`}>
                    👥
                  </span>
                )}
                <span className="text-4xl" aria-hidden="true">
                  {g.icon}
                </span>
                <span className="font-semibold leading-tight">{g.title}</span>
                <span className="text-xs text-muted">
                  by {g.owner_name} · {g.plays} {g.plays === 1 ? "play" : "plays"}
                </span>
                <span className="mt-auto flex gap-1.5 pt-1">
                  <Link href={`/live/host/new?mode=custom&game=${g.id}`} className="flex-1 rounded-full bg-accent px-3 py-1.5 text-center text-xs font-semibold text-on-accent">
                    📺 Host it
                  </Link>
                  <Link href={`/community/${g.id}`} className="rounded-full border border-line px-3 py-1.5 text-xs font-medium hover:bg-accent/10">
                    Try
                  </Link>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

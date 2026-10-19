import type { Metadata } from "next";
import { LeaderboardTabs } from "@/components/LeaderboardTabs";
import { GAMES, getGame } from "@/lib/games";

export const metadata: Metadata = { title: "Leaderboards" };

export default async function LeaderboardsPage({ searchParams }: PageProps<"/leaderboards">) {
  const q = (await searchParams).game;
  const game = getGame(typeof q === "string" ? q : "") ?? GAMES[0];
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leaderboards</h1>
        <p className="mt-1 text-muted">Everyone&apos;s best score on Jace, one per player.</p>
      </div>
      <LeaderboardTabs initial={game.id} />
    </div>
  );
}

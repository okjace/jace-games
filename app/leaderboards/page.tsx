import type { Metadata } from "next";
import { Suspense } from "react";
import { LiveBoards } from "@/components/live/LiveBoards";

export const metadata: Metadata = { title: "leaderboards 🏆", description: "The best Jace Live players in every game mode." };

export default function LeaderboardsPage() {
  return (
    <Suspense>
      <LiveBoards />
    </Suspense>
  );
}

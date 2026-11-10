import type { Metadata } from "next";
import { LiveGames } from "@/components/live/LiveGames";

export const metadata: Metadata = { title: "Join a live game", description: "Live quiz games people are hosting right now. Join one." };

export default function LiveGamesPage() {
  return <LiveGames />;
}

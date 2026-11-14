import type { Metadata } from "next";
import { LiveGames } from "@/components/live/LiveGames";

export const metadata: Metadata = { title: "games happenin rn 🌍", description: "Live quiz games ppl are hosting right now. Join one." };

export default function LiveGamesPage() {
  return <LiveGames />;
}

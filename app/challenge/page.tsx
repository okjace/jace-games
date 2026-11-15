import type { Metadata } from "next";
import { WeeklyChallenge } from "@/components/live/WeeklyChallenge";

export const metadata: Metadata = { title: "weekly challenge 🗓️", description: "One mode a week, its own leaderboard, prizes for the top 3." };

export default function ChallengePage() {
  return <WeeklyChallenge />;
}

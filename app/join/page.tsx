import type { Metadata } from "next";
import { JoinPage } from "@/components/live/JoinPage";

export const metadata: Metadata = { title: "Join a game", description: "Join a Jace Live game with its code, or jump into one that's open to everyone." };

export default function Join() {
  return <JoinPage />;
}

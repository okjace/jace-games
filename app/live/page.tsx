import type { Metadata } from "next";
import { LiveHome } from "@/components/live/LiveHome";

export const metadata: Metadata = {
  title: "Live",
  description: "Host a live quiz game for a room full of people, or join one with a code.",
};

export default function LivePage() {
  return <LiveHome />;
}

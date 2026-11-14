import type { Metadata } from "next";
import { Discover } from "@/components/live/Discover";

export const metadata: Metadata = { title: "discover sets 🔎", description: "Find question sets to host on Jace Live." };

export default function DiscoverPage() {
  return <Discover />;
}

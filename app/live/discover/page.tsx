import type { Metadata } from "next";
import { Discover } from "@/components/live/Discover";

export const metadata: Metadata = { title: "Discover sets", description: "Find question sets to host on Jace Games Live." };

export default function DiscoverPage() {
  return <Discover />;
}

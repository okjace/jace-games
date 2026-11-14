import type { Metadata } from "next";
import { MySets } from "@/components/live/MySets";

export const metadata: Metadata = { title: "My sets", description: "Your Jace Live question sets." };

export default function MySetsPage() {
  return <MySets />;
}

import type { Metadata } from "next";
import { MySets } from "@/components/live/MySets";

export const metadata: Metadata = { title: "my sets 📚", description: "Ur Jace Live question sets." };

export default function MySetsPage() {
  return <MySets />;
}

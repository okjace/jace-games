import type { Metadata } from "next";
import { Watch } from "@/components/live/Watch";

export const metadata: Metadata = { title: "watchin a game 👀", description: "Watch a Jace Live game without playing." };

export default async function WatchPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <Watch code={code} />;
}

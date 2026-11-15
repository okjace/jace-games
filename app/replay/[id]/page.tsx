import type { Metadata } from "next";
import { ReplayViewer } from "@/components/live/ReplayViewer";

export const metadata: Metadata = { title: "replay 🎬", description: "Watch a Jace Live game back, start to finish." };

export default async function ReplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReplayViewer id={id} />;
}

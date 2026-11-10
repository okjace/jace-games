import type { Metadata } from "next";
import { Moderation } from "@/components/live/Moderation";

export const metadata: Metadata = { title: "Moderation", robots: { index: false } };

export default function ModerationPage() {
  return <Moderation />;
}

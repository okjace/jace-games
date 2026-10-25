import type { Metadata } from "next";
import { StudioHome } from "@/components/studio/StudioHome";

export const metadata: Metadata = { title: "Game Studio", description: "Make your own games with code or blocks and share them." };

export default function StudioPage() {
  return <StudioHome />;
}

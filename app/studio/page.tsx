import type { Metadata } from "next";
import { StudioHome } from "@/components/studio/StudioHome";

export const metadata: Metadata = { title: "game studio 🧩", description: "Make ur own games w/ code or blocks and share them." };

export default function StudioPage() {
  return <StudioHome />;
}

import type { Metadata } from "next";
import { PlayLive } from "@/components/live/PlayLive";

export const metadata: Metadata = { title: "playin live 🎮" };

export default async function PlayLivePage({ params }: PageProps<"/live/play/[code]">) {
  const { code } = await params;
  return <PlayLive code={code} />;
}

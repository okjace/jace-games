import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlayView } from "@/components/PlayView";
import { GAMES, getGame } from "@/lib/games";

export function generateStaticParams() {
  return GAMES.map((g) => ({ gameId: g.id }));
}

export async function generateMetadata({ params }: PageProps<"/play/[gameId]">): Promise<Metadata> {
  const game = getGame((await params).gameId);
  return game ? { title: game.name, description: game.description } : {};
}

export default async function PlayPage({ params }: PageProps<"/play/[gameId]">) {
  const { gameId } = await params;
  if (!getGame(gameId)) notFound();
  return <PlayView gameId={gameId} />;
}

import type { Metadata } from "next";
import { RoomView } from "@/components/room/RoomView";

export async function generateMetadata({ params }: PageProps<"/r/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: `Room ${code.toUpperCase()}`, description: "Join this game on Jace Games." };
}

export default async function RoomPage({ params }: PageProps<"/r/[code]">) {
  const { code } = await params;
  return <RoomView code={code.toUpperCase()} />;
}

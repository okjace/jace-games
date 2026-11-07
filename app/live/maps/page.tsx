import type { Metadata } from "next";
import { MapList } from "@/components/live/MapList";

export const metadata: Metadata = { title: "Tower Siege maps", description: "Make and share maps for Tower Siege on Jace Games Live." };

export default function MapsPage() {
  return <MapList />;
}

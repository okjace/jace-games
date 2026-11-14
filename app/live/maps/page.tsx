import type { Metadata } from "next";
import { MapList } from "@/components/live/MapList";

export const metadata: Metadata = { title: "tower siege maps 🗺️", description: "Make and share maps for Tower Siege on Jace Live." };

export default function MapsPage() {
  return <MapList />;
}

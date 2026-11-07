import type { Metadata } from "next";
import { MapEditor } from "@/components/live/MapEditor";

export const metadata: Metadata = { title: "Edit map" };

export default async function EditMapPage({ params }: PageProps<"/live/maps/[id]/edit">) {
  const { id } = await params;
  return <MapEditor id={id} />;
}

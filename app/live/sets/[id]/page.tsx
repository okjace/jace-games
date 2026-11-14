import type { Metadata } from "next";
import { SetView } from "@/components/live/SetView";

export const metadata: Metadata = { title: "a question set 📚" };

export default async function SetPage({ params }: PageProps<"/live/sets/[id]">) {
  const { id } = await params;
  return <SetView id={id} />;
}

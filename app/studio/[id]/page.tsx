import type { Metadata } from "next";
import { Editor } from "@/components/studio/Editor";

export const metadata: Metadata = { title: "makin a game 🧩" };

export default async function StudioEditorPage({ params }: PageProps<"/studio/[id]">) {
  const { id } = await params;
  return <Editor id={id} />;
}

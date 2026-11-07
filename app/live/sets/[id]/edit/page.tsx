import type { Metadata } from "next";
import { SetEditor } from "@/components/live/SetEditor";

export const metadata: Metadata = { title: "Edit set" };

export default async function EditSetPage({ params }: PageProps<"/live/sets/[id]/edit">) {
  const { id } = await params;
  return <SetEditor id={id} />;
}

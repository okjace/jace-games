import type { Metadata } from "next";
import { ThemeMaker } from "@/components/site/ThemeMaker";

export const metadata: Metadata = { title: "editin a theme 🎨" };

export default async function EditThemePage({ params }: PageProps<"/themes/[id]/edit">) {
  const { id } = await params;
  return <ThemeMaker id={id} />;
}

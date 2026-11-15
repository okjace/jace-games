import type { Metadata } from "next";
import { Suspense } from "react";
import { ThemeMaker } from "@/components/site/ThemeMaker";

export const metadata: Metadata = { title: "editin a theme 🎨" };

export default async function EditThemePage({ params }: PageProps<"/themes/[id]/edit">) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-foreground/[.04]" />}>
      <ThemeMaker id={id} />
    </Suspense>
  );
}

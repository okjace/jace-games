import type { Metadata } from "next";
import { Suspense } from "react";
import { ThemeMaker } from "@/components/site/ThemeMaker";

export const metadata: Metadata = { title: "theme maker 🎨" };

export default function NewThemePage() {
  // The maker reads ?remix= from the address.
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-foreground/[.04]" />}>
      <ThemeMaker />
    </Suspense>
  );
}

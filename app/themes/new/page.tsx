import type { Metadata } from "next";
import { ThemeMaker } from "@/components/site/ThemeMaker";

export const metadata: Metadata = { title: "theme maker 🎨" };

export default function NewThemePage() {
  return <ThemeMaker />;
}

import type { Metadata } from "next";
import { ThemeMarket } from "@/components/site/ThemeMarket";

export const metadata: Metadata = { title: "theme market 🛍️", description: "Themes made by people on Jace Live. Install one or make ur own." };

export default function ThemesPage() {
  return <ThemeMarket />;
}

import type { Metadata } from "next";
import { Locker } from "@/components/live/Locker";

export const metadata: Metadata = { title: "Locker", description: "Pick your icon and frame for Jace Games Live." };

export default function LockerPage() {
  return <Locker />;
}

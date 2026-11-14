import type { Metadata } from "next";
import { Locker } from "@/components/live/Locker";

export const metadata: Metadata = { title: "Locker", description: "Pick ur icon and frame for Jace Live." };

export default function LockerPage() {
  return <Locker />;
}

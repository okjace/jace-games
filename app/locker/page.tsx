import type { Metadata } from "next";
import { Locker } from "@/components/live/Locker";

export const metadata: Metadata = { title: "ur locker 🎽", description: "Ur look across Jace Live: icon, frame, name color, title, badges and more." };

export default function LockerPage() {
  return <Locker />;
}

import type { Metadata } from "next";
import { Locker } from "@/components/live/Locker";

export const metadata: Metadata = { title: "Locker", description: "Your look across Jace Games: icon, frame, name color, title, badges and more." };

export default function LockerPage() {
  return <Locker />;
}

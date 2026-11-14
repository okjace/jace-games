import type { Metadata } from "next";
import { FindPeople } from "@/components/site/People";

export const metadata: Metadata = { title: "find ppl 👥", description: "Public Jace Live profiles." };

export default function PeoplePage() {
  return <FindPeople />;
}

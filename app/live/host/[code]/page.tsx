import type { Metadata } from "next";
import { HostScreen } from "@/components/live/HostScreen";

export const metadata: Metadata = { title: "hostin a game rn 📺" };

export default async function HostPage({ params }: PageProps<"/live/host/[code]">) {
  const { code } = await params;
  return <HostScreen code={code} />;
}

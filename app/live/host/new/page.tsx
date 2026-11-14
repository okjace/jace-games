import type { Metadata } from "next";
import { Suspense } from "react";
import { HostSetup } from "@/components/live/HostSetup";

export const metadata: Metadata = { title: "host a game 📺" };

export default function HostNewPage() {
  return (
    <Suspense>
      <HostSetup />
    </Suspense>
  );
}

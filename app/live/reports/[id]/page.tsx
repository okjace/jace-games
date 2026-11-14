import type { Metadata } from "next";
import { SavedReport } from "@/components/live/Reports";

export const metadata: Metadata = { title: "a report 📋" };

export default async function ReportPage({ params }: PageProps<"/live/reports/[id]">) {
  const { id } = await params;
  return <SavedReport id={id} />;
}

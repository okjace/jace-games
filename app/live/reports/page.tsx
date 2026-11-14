import type { Metadata } from "next";
import { ReportList } from "@/components/live/Reports";

export const metadata: Metadata = { title: "ur reports 📋", description: "What playas answered in the Live games u hosted." };

export default function ReportsPage() {
  return <ReportList />;
}

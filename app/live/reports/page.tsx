import type { Metadata } from "next";
import { ReportList } from "@/components/live/Reports";

export const metadata: Metadata = { title: "Reports", description: "What players answered in the Live games you hosted." };

export default function ReportsPage() {
  return <ReportList />;
}

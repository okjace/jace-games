import { NextResponse } from "next/server";
import { reportStore } from "@/lib/db/liveReports";
import { liveError } from "@/lib/live/http";
import type { ReportSummary } from "@/lib/live/report";
import { getSession } from "@/lib/session";

/** Reports from games I hosted (the last 90 days). */
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in with Jace to see reports." }, { status: 401 });
  try {
    const rows = await reportStore().mine(session.user.id);
    const reports: ReportSummary[] = rows.map((r) => ({
      id: r.id,
      code: r.code,
      modeName: r.data.modeName,
      setTitle: r.set_title,
      endedAt: r.data.endedAt ?? r.created_at,
      players: r.data.players.length,
      questions: r.data.questions.length,
    }));
    return NextResponse.json({ reports }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return liveError(e);
  }
}

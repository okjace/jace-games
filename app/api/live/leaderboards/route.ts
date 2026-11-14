import { NextResponse, type NextRequest } from "next/server";
import { topScores } from "@/lib/db/liveBoards";
import { MODES } from "@/lib/live/types";

/** GET ?mode= → the top 50 for that Live mode. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const mode = req.nextUrl.searchParams.get("mode") ?? "classic";
  if (!(mode in MODES)) return NextResponse.json({ error: "No such mode." }, { status: 404 });
  const rows = await topScores(mode, 50);
  return NextResponse.json({ rows: rows.map((r) => ({ name: r.username, best: r.best, avatar: r.avatar, at: r.updated_at })) });
}

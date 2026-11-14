import { NextResponse, type NextRequest } from "next/server";
import { LiveError, submitToBoard } from "@/lib/live/engine";
import { getSession } from "@/lib/session";

/** POST (X-Live-Token): put this player's score from an ended game on the global leaderboard for its mode. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/live/games/[code]/leaderboard">): Promise<NextResponse> {
  const { code } = await ctx.params;
  try {
    return NextResponse.json(await submitToBoard(code, req.headers.get("x-live-token"), await getSession()));
  } catch (e) {
    if (e instanceof LiveError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { hostReport } from "@/lib/live/engine";
import { liveError } from "@/lib/live/http";
import { getSession } from "@/lib/session";

/** The host's report for a game: every question and what each player chose. Host only. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/live/games/[code]/report">): Promise<NextResponse> {
  const { code } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in with Jace to see reports." }, { status: 401 });
  try {
    return NextResponse.json(await hostReport(code, session), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return liveError(e);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { signedOut, studioErrorResponse, submitScore, topScores } from "@/lib/studio/server";

/** The top 20 (best per player). Games report their own scores, so these are unverified. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/studio/games/[id]/scores">): Promise<NextResponse> {
  const { id } = await ctx.params;
  try {
    return NextResponse.json({ scores: await topScores(id), verified: false }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return studioErrorResponse(e);
  }
}

/** { score } from jace.submitScore(). Keeps the player's best. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/studio/games/[id]/scores">): Promise<NextResponse> {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return signedOut();
  const body = (await req.json().catch(() => null)) as { score?: unknown } | null;
  try {
    return NextResponse.json(await submitScore(session, id, body?.score));
  } catch (e) {
    return studioErrorResponse(e);
  }
}

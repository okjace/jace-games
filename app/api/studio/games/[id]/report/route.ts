import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { report, signedOut, studioErrorResponse } from "@/lib/studio/server";

/** { reason } — tells the site owner something's wrong with a game. One report per person per game. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/studio/games/[id]/report">): Promise<NextResponse> {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return signedOut();
  const body = (await req.json().catch(() => null)) as { reason?: unknown } | null;
  try {
    await report(session, id, body?.reason);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return studioErrorResponse(e);
  }
}

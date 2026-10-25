import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { listVersions, signedOut, studioErrorResponse } from "@/lib/studio/server";

/** The owner's saved versions, newest first. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/studio/games/[id]/versions">): Promise<NextResponse> {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return signedOut();
  try {
    return NextResponse.json({ versions: await listVersions(session, id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return studioErrorResponse(e);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getVersion, signedOut, studioErrorResponse } from "@/lib/studio/server";

/** One saved version's code, for restoring it in the editor. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/studio/games/[id]/versions/[version]">): Promise<NextResponse> {
  const { id, version } = await ctx.params;
  const session = await getSession();
  if (!session) return signedOut();
  try {
    return NextResponse.json(await getVersion(session, id, Number(version)), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return studioErrorResponse(e);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { getReplay } from "@/lib/db/liveReplays";

/** A saved replay (anyone with the link). */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/replays/[id]">): Promise<NextResponse> {
  const { id } = await ctx.params;
  const row = await getReplay(id).catch(() => null);
  if (!row) return NextResponse.json({ error: "That replay is gone (they last 30 days)." }, { status: 404 });
  return NextResponse.json({ replay: row.data, expires: row.expires_at }, { headers: { "Cache-Control": "public, max-age=300" } });
}

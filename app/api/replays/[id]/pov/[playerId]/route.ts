import { NextResponse, type NextRequest } from "next/server";
import { getPov, getReplay } from "@/lib/db/liveReplays";

/** What one player's screen showed during a replayed game. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/replays/[id]/pov/[playerId]">): Promise<NextResponse> {
  const { id, playerId } = await ctx.params;
  if (!(await getReplay(id).catch(() => null))) return NextResponse.json({ error: "That replay is gone." }, { status: 404 });
  const frames = await getPov(id, playerId.slice(0, 64)).catch(() => null);
  if (!frames) return NextResponse.json({ error: "No screen saved for that player." }, { status: 404 });
  return NextResponse.json({ frames }, { headers: { "Cache-Control": "public, max-age=300" } });
}

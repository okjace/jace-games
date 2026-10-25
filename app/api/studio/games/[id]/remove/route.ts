import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { setRemoved, signedOut, studioErrorResponse } from "@/lib/studio/server";

/** Site owner only: { removed: true } takes a game down; false puts it back. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/studio/games/[id]/remove">): Promise<NextResponse> {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return signedOut();
  const body = (await req.json().catch(() => null)) as { removed?: unknown } | null;
  if (typeof body?.removed !== "boolean") return NextResponse.json({ error: "Send { removed }." }, { status: 400 });
  try {
    const game = await setRemoved(session, id, body.removed);
    return NextResponse.json({ ok: true, removed: game.removed });
  } catch (e) {
    return studioErrorResponse(e);
  }
}

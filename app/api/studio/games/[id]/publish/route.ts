import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { setPublished, signedOut, studioErrorResponse } from "@/lib/studio/server";

/** { published: true } copies the draft to what players get; { published: false } hides the game. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/studio/games/[id]/publish">): Promise<NextResponse> {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return signedOut();
  const body = (await req.json().catch(() => null)) as { published?: unknown } | null;
  if (typeof body?.published !== "boolean") return NextResponse.json({ error: "Send { published }." }, { status: 400 });
  try {
    const game = await setPublished(session, id, body.published);
    return NextResponse.json({ ok: true, published: game.published, published_at: game.published_at });
  } catch (e) {
    return studioErrorResponse(e);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { deleteGame, saveGame, signedOut, studioErrorResponse, viewGame } from "@/lib/studio/server";

/** A game: the published version for everyone, plus the draft for its owner. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/studio/games/[id]">): Promise<NextResponse> {
  const { id } = await ctx.params;
  try {
    return NextResponse.json(await viewGame(id, await getSession()), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return studioErrorResponse(e);
  }
}

/** Saves the draft: any of { title, description, icon, multiplayer, html, blocks_json, kind: "code" }. */
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/studio/games/[id]">): Promise<NextResponse> {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return signedOut();
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Send the changes as JSON." }, { status: 400 });
  try {
    const game = await saveGame(session, id, body);
    return NextResponse.json({ ok: true, updated_at: game.updated_at, kind: game.kind });
  } catch (e) {
    return studioErrorResponse(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/studio/games/[id]">): Promise<NextResponse> {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return signedOut();
  try {
    await deleteGame(session, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return studioErrorResponse(e);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { createGame, myGames, signedOut, studioErrorResponse } from "@/lib/studio/server";

/** The signed-in person's games, newest change first. */
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return signedOut();
  try {
    return NextResponse.json({ games: await myGames(session) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return studioErrorResponse(e);
  }
}

/** Makes a game: { title, kind: "code" | "blocks", html, blocks_json?, icon?, description?, multiplayer? } → { game }. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return signedOut();
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Send the game as JSON." }, { status: 400 });
  try {
    const game = await createGame(session, body);
    return NextResponse.json({ game: { id: game.id } }, { status: 201 });
  } catch (e) {
    return studioErrorResponse(e);
  }
}

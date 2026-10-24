import { NextResponse, type NextRequest } from "next/server";
import { roomStore } from "@/lib/db/rooms";
import { getGame } from "@/lib/games";
import { getSession } from "@/lib/session";

/** ?game= → most multiplayer wins for that game; ?me=1 → the signed-in player's record per game. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    if (req.nextUrl.searchParams.get("me")) {
      const session = await getSession();
      if (!session) return NextResponse.json({ records: [] });
      return NextResponse.json({ records: await roomStore().userRecord(session.user.id) });
    }
    const game = getGame(req.nextUrl.searchParams.get("game") ?? "");
    if (!game?.multiplayer) return NextResponse.json({ error: "unknown_game" }, { status: 400 });
    return NextResponse.json({ rows: await roomStore().winsLeaderboard(game.id, 50) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}

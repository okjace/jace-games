import { NextResponse } from "next/server";
import { myActiveGames } from "@/lib/live/engine";
import { liveError } from "@/lib/live/http";
import { getSession } from "@/lib/session";

/** The signed-in player's unfinished Live games (hosted or solo), on any device. */
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ games: [] });
  try {
    return NextResponse.json({ games: await myActiveGames(session) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return liveError(e);
  }
}

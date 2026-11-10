import { NextResponse } from "next/server";
import { publicLiveGames } from "@/lib/live/engine";
import { liveError } from "@/lib/live/http";

/** Live games their hosts listed on Discover that are still going: anyone can join. */
export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json({ games: await publicLiveGames() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return liveError(e);
  }
}

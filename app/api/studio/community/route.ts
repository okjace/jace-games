import { NextResponse } from "next/server";
import { publishedGames, studioErrorResponse } from "@/lib/studio/server";

/** Published community games, newest first. */
export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json({ games: await publishedGames() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return studioErrorResponse(e);
  }
}

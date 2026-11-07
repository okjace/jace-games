import { NextResponse, type NextRequest } from "next/server";
import { roomStore } from "@/lib/db/rooms";
import { deleteExpiredLiveGames } from "@/lib/live/engine";

/** Daily (vercel.json): deletes rooms and Live games past their expiry. Vercel sends CRON_SECRET as a bearer token. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const deleted = await roomStore().deleteExpired(new Date().toISOString());
  const liveDeleted = await deleteExpiredLiveGames();
  return NextResponse.json({ deleted, liveDeleted });
}

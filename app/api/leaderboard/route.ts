import { NextResponse, type NextRequest } from "next/server";
import { getGame } from "@/lib/games";
import { getLeaderboard } from "@/lib/jace";
import { withJace } from "@/lib/routes";

/** Best score per player across all of Jace, best first. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const game = getGame(req.nextUrl.searchParams.get("game") ?? "");
  if (!game) return NextResponse.json({ error: "unknown_game" }, { status: 400 });
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 50));
  const order = game.better === "higher" ? "desc" : "asc";
  return withJace(async ({ token }) => ({ scores: await getLeaderboard(token, game.id, order, limit) }));
}

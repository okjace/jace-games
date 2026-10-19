import { NextResponse, type NextRequest } from "next/server";
import { getGame } from "@/lib/games";
import { getMyScores, importScores } from "@/lib/jace";
import { withJace } from "@/lib/routes";
import { validateSubmission } from "@/lib/validate";
import type { ScoreSubmission } from "@/lib/types";

const MAX_BATCH = 500;

/** The signed-in player's own scores from Jace (including ones from the old Jace site). */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const game = req.nextUrl.searchParams.get("game") ?? undefined;
  if (game && !getGame(game)) return NextResponse.json({ error: "unknown_game" }, { status: 400 });
  return withJace(async ({ token }) => ({ scores: await getMyScores(token, game) }));
}

/**
 * Uploads scores to Jace: `{ scores: ScoreSubmission[] }`. Each one is checked
 * on the server first; ones that fail are reported back as `rejected` and
 * never sent. Every accepted one carries its external_id, so a retry after a
 * dropped connection can't create duplicates.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as { scores?: unknown } | null;
  if (!body || !Array.isArray(body.scores) || body.scores.length === 0) {
    return NextResponse.json({ error: "Send { scores: [...] }." }, { status: 400 });
  }
  if (body.scores.length > MAX_BATCH) {
    return NextResponse.json({ error: `At most ${MAX_BATCH} scores at once.` }, { status: 400 });
  }

  const valid: ScoreSubmission[] = [];
  const rejected: { id: string | null; reason: string }[] = [];
  for (const raw of body.scores) {
    const result = validateSubmission(raw);
    if (result.ok) valid.push(result.value);
    else rejected.push({ id: result.id, reason: result.reason });
  }

  return withJace(async ({ token }) => {
    const counts = valid.length > 0 ? await importScores(token, valid) : { imported: 0, skipped: 0 };
    return { ...counts, accepted: valid.map((s) => s.external_id), rejected };
  });
}

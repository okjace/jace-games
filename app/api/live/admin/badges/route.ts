import { NextResponse, type NextRequest } from "next/server";
import { grantedOf, lockerStore, statsOf } from "@/lib/db/liveLocker";
import { BADGES, badgeById, hasBadge, levelInfo } from "@/lib/live/locker";
import { isSiteOwner } from "@/lib/owner";
import { getSession } from "@/lib/session";

/**
 * Site owner only: give someone a badge, or take one you gave back.
 * POST { userId, badge, give: true | false } or { userId, all: true } → their badges.
 * Badges earned by playing stay earned; taking back only removes a given one.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session || !isSiteOwner(session.user.id)) return NextResponse.json({ error: "Only the site owner can do this." }, { status: 403 });
  const body = ((await req.json().catch(() => null)) ?? {}) as { userId?: unknown; badge?: unknown; give?: unknown; all?: unknown };
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!userId || userId.length > 80) return NextResponse.json({ error: "Pick someone." }, { status: 400 });
  const store = lockerStore();
  const row = await store.get(userId);
  let granted = grantedOf(row);
  if (body.all === true) granted = BADGES.map((b) => b.id);
  else {
    const badge = typeof body.badge === "string" && badgeById(body.badge) ? body.badge : null;
    if (!badge) return NextResponse.json({ error: "That badge doesn't exist." }, { status: 400 });
    granted = body.give === false ? granted.filter((b) => b !== badge) : [...new Set([...granted, badge])];
  }
  await store.setGranted(userId, granted);
  const level = levelInfo(row.xp).level;
  return NextResponse.json({
    userId,
    granted,
    badges: BADGES.filter((b) => hasBadge(b.id, statsOf(row), level, granted)).map((b) => b.id),
  });
}

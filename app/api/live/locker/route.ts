import { NextResponse, type NextRequest } from "next/server";
import { lockerStore, lookOf, statsOf } from "@/lib/db/liveLocker";
import { liveError } from "@/lib/live/http";
import { BADGES, cleanAvatar, levelInfo, safePicture } from "@/lib/live/locker";
import { isSiteOwner } from "@/lib/owner";
import { allow } from "@/lib/rateLimit";
import { getSession } from "@/lib/session";

/**
 * GET: my locker (XP, level, stats, badges earned, what I show).
 * PUT { icon, frame, custom, fx, title, nameColor, effect, badge }: change what I show.
 * Every choice must be unlocked (by level, or for badges, by stats).
 */
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in with Jace to use the locker." }, { status: 401 });
  try {
    const row = await lockerStore().get(session.user.id);
    await lockerStore()
      .touch(session.user.id, session.user.username)
      .catch(() => {});
    const info = levelInfo(row.xp);
    const stats = statsOf(row);
    const picture = safePicture(session.user.picture);
    return NextResponse.json(
      {
        xp: row.xp,
        ...info,
        stats,
        badges: BADGES.filter((b) => b.earned(stats, info.level)).map((b) => b.id),
        avatar: cleanAvatar(lookOf(row), info.level, picture, stats),
        picture,
        owner: isSiteOwner(session.user.id),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return liveError(e);
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in with Jace to use the locker." }, { status: 401 });
  if (!allow(`live-locker:${session.user.id}`, 40, 60_000)) return NextResponse.json({ error: "Slow down a little!" }, { status: 429 });
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  try {
    const row = await lockerStore().get(session.user.id);
    const level = levelInfo(row.xp).level;
    const avatar = cleanAvatar(body, level, safePicture(session.user.picture), statsOf(row));
    // Anything asked for that didn't survive the check wasn't unlocked.
    const same = (a: unknown, b: unknown) => (a ?? "") === (b ?? "");
    if (
      !same(avatar.icon, body.icon) ||
      !same(avatar.frame, body.frame) ||
      !same(avatar.fx, body.fx) ||
      !same(avatar.title, body.title) ||
      !same(avatar.nameColor, body.nameColor) ||
      !same(avatar.effect, body.effect) ||
      !same(avatar.badge, body.badge)
    ) {
      return NextResponse.json({ error: "That isn't unlocked yet." }, { status: 403 });
    }
    await lockerStore().setLook(session.user.id, {
      icon: avatar.icon,
      frame: avatar.frame,
      custom_frame: avatar.custom ?? (row.custom_frame ?? null),
      fx: avatar.fx ?? "",
      title: avatar.title ?? "",
      name_color: avatar.nameColor ?? "",
      effect: avatar.effect ?? "",
      badge: avatar.badge ?? "",
    });
    return NextResponse.json({ avatar });
  } catch (e) {
    return liveError(e);
  }
}

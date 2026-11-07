import { NextResponse, type NextRequest } from "next/server";
import { lockerStore } from "@/lib/db/liveLocker";
import { liveError } from "@/lib/live/http";
import { cleanAvatar, levelInfo, safePicture } from "@/lib/live/locker";
import { allow } from "@/lib/rateLimit";
import { getSession } from "@/lib/session";

/** GET: my locker (XP, level, what I show). PUT { icon, frame }: change what I show (must be unlocked). */
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in with Jace to use the locker." }, { status: 401 });
  try {
    const row = await lockerStore().get(session.user.id);
    const info = levelInfo(row.xp);
    const picture = safePicture(session.user.picture);
    return NextResponse.json({ xp: row.xp, ...info, avatar: cleanAvatar(row, info.level, picture), picture }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return liveError(e);
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in with Jace to use the locker." }, { status: 401 });
  if (!allow(`live-locker:${session.user.id}`, 30, 60_000)) return NextResponse.json({ error: "Slow down a little!" }, { status: 429 });
  const body = await req.json().catch(() => null);
  try {
    const row = await lockerStore().get(session.user.id);
    const level = levelInfo(row.xp).level;
    const picture = safePicture(session.user.picture);
    const avatar = cleanAvatar(body, level, picture);
    if (avatar.icon !== (body as { icon?: unknown })?.icon || avatar.frame !== (body as { frame?: unknown })?.frame) {
      return NextResponse.json({ error: "That isn't unlocked yet." }, { status: 403 });
    }
    await lockerStore().setLook(session.user.id, { icon: avatar.icon, frame: avatar.frame });
    return NextResponse.json({ avatar });
  } catch (e) {
    return liveError(e);
  }
}

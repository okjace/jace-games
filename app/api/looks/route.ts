import { NextResponse, type NextRequest } from "next/server";
import { grantedOf, lockerStore, lookOf, statsOf } from "@/lib/db/liveLocker";
import { cleanAvatar, levelInfo, type Avatar } from "@/lib/live/locker";
import { allow } from "@/lib/rateLimit";

/**
 * GET ?ids=a,b,c → { looks: { [userId]: Avatar } }: how people show up
 * around Jace Games (from their Locker), already checked against what each
 * has unlocked. People without a locker aren't listed. A look using a Jace
 * picture comes back as icon "jace" without the picture; the page already
 * has it from Jace.
 */
const JACE_MARK = "https://jace.picture/";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allow(`looks:${ip}`, 120, 60_000)) return NextResponse.json({ looks: {} }, { status: 429 });
  const ids = [...new Set((req.nextUrl.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter((s) => s && s.length <= 80))].slice(0, 60);
  const rows = await lockerStore()
    .many(ids)
    .catch(() => []);
  const looks: Record<string, Avatar> = {};
  for (const r of rows) {
    const a = cleanAvatar(lookOf(r), levelInfo(r.xp).level, JACE_MARK, statsOf(r), grantedOf(r));
    delete a.picture;
    looks[r.user_id] = { ...a, level: levelInfo(r.xp).level } as Avatar;
  }
  return NextResponse.json({ looks }, { headers: { "Cache-Control": "public, max-age=30" } });
}

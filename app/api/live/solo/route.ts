import { NextResponse, type NextRequest } from "next/server";
import { startSoloGame } from "@/lib/live/engine";
import { liveError } from "@/lib/live/http";
import type { LiveMode } from "@/lib/live/types";
import { allow } from "@/lib/rateLimit";
import { getSession } from "@/lib/session";

/** Play solo: { setId | null, mode, settings } → { code, token }. The game is already running. No sign-in needed. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  const who = session?.user.id ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  if (!allow(`live-solo:${who}`, 30, 3_600_000)) return NextResponse.json({ error: "You've played a lot of solo games this hour. Take a break!" }, { status: 429 });
  const body = ((await req.json().catch(() => null)) ?? {}) as { setId?: unknown; mode?: unknown; settings?: unknown; avatar?: unknown };
  const raw = (body.settings ?? {}) as Record<string, unknown>;
  try {
    const result = await startSoloGame(session, {
      setId: typeof body.setId === "string" && /^[0-9a-f-]{36}$/.test(body.setId) ? body.setId : null,
      mode: (body.mode as LiveMode) ?? "classic",
      settings: { minutes: raw.minutes, shuffle: raw.shuffle, mapId: raw.mapId, gameId: raw.gameId },
    }, body.avatar);
    return NextResponse.json(result);
  } catch (e) {
    return liveError(e);
  }
}

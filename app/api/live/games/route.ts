import { NextResponse, type NextRequest } from "next/server";
import { createLiveGame } from "@/lib/live/engine";
import { liveError } from "@/lib/live/http";
import type { LiveMode } from "@/lib/live/types";
import { getSession } from "@/lib/session";

/** Host a game: { setId | null, mode, settings } → { code }. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in with Jace to host." }, { status: 401 });
  const body = ((await req.json().catch(() => null)) ?? {}) as { setId?: unknown; mode?: unknown; settings?: unknown };
  try {
    const code = await createLiveGame(session, {
      setId: typeof body.setId === "string" && /^[0-9a-f-]{36}$/.test(body.setId) ? body.setId : null,
      mode: (body.mode as LiveMode) ?? "classic",
      settings: (body.settings as Record<string, unknown>) ?? {},
    });
    return NextResponse.json({ code });
  } catch (e) {
    return liveError(e);
  }
}

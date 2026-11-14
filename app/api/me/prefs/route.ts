import { NextResponse, type NextRequest } from "next/server";
import { getPrefs, savePrefs, type Prefs } from "@/lib/db/userPrefs";
import { allow } from "@/lib/rateLimit";
import { isSeasonId } from "@/lib/seasons";
import { getSession } from "@/lib/session";

const MODES = ["chaos", "chill", "crt", "comic", "rainbow", "bigtext"];

/** GET: my saved settings (null if none yet). PUT { theme?, modes?, effectsOff? }: save them. */
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ prefs: null }, { status: 401 });
  return NextResponse.json({ prefs: await getPrefs(session.user.id) });
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to save ur settings." }, { status: 401 });
  if (!allow(`prefs:${session.user.id}`, 30, 60_000)) return NextResponse.json({ error: "Slow down a little!" }, { status: 429 });
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const cur = (await getPrefs(session.user.id)) ?? {};
  const next: Prefs = { ...cur };
  if (typeof body.theme === "string" && (body.theme === "site" || isSeasonId(body.theme))) next.theme = body.theme;
  if (Array.isArray(body.modes)) next.modes = body.modes.filter((m): m is string => typeof m === "string" && MODES.includes(m)).slice(0, MODES.length);
  if (typeof body.effectsOff === "boolean") next.effectsOff = body.effectsOff;
  await savePrefs(session.user.id, next);
  return NextResponse.json({ prefs: next });
}

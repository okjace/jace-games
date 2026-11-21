import { NextResponse, type NextRequest } from "next/server";
import { getPrefs, savePrefs, type Prefs } from "@/lib/db/userPrefs";
import { allow } from "@/lib/rateLimit";
import { isSeasonId } from "@/lib/seasons";
import { getSession } from "@/lib/session";
import { isEmailKind } from "@/lib/emailKinds";

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
  if (typeof body.theme === "string" && (body.theme === "site" || isSeasonId(body.theme) || /^custom:[0-9a-f-]{36}$/i.test(body.theme))) next.theme = body.theme;
  if (Array.isArray(body.modes)) next.modes = body.modes.filter((m): m is string => typeof m === "string" && MODES.includes(m)).slice(0, MODES.length);
  if (typeof body.effectsOff === "boolean") next.effectsOff = body.effectsOff;
  if (typeof body.noChat === "boolean") next.noChat = body.noChat;
  if (typeof body.noCalls === "boolean") next.noCalls = body.noCalls;
  if (body.termsSeen === true) next.termsSeen = true;
  if (body.look === "light" || body.look === "dark" || body.look === "auto") next.look = body.look;
  if (typeof body.publicProfile === "boolean") next.publicProfile = body.publicProfile;
  if (body.emails && typeof body.emails === "object") {
    const emails = { ...(cur.emails ?? {}) };
    for (const [k, v] of Object.entries(body.emails as Record<string, unknown>)) if (isEmailKind(k) && typeof v === "boolean") emails[k] = v;
    next.emails = emails;
  }
  if (typeof body.bio === "string") next.bio = body.bio.replace(/[<>]/g, "").slice(0, 160);
  // A public profile keeps the name it's found by up to date.
  next.username = session.user.username;
  next.displayName = session.user.displayName || session.user.username;
  await savePrefs(session.user.id, next);
  return NextResponse.json({ prefs: next });
}

import { NextResponse, type NextRequest } from "next/server";
import { profileStore } from "@/lib/db/profiles";
import { getUserInfo } from "@/lib/jace";
import { cleanDisplayName } from "@/lib/profile";
import { allow } from "@/lib/rateLimit";
import { getSession, setSessionCookie } from "@/lib/session";

/** PUT { displayName }: set (or clear, with "") the name people see. The username stays your Jace username. */
export async function PUT(req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in with Jace first." }, { status: 401 });
  if (!allow(`profile:${session.user.id}`, 10, 60_000)) return NextResponse.json({ error: "Slow down a little!" }, { status: 429 });
  const body = ((await req.json().catch(() => null)) ?? {}) as { displayName?: unknown };
  const cleaned = cleanDisplayName(body.displayName);
  if (!cleaned.ok) return NextResponse.json({ error: cleaned.error }, { status: 400 });
  if (cleaned.name) {
    const info = await getUserInfo(session.token).catch(() => null);
    if (info?.banned || info?.muted) return NextResponse.json({ error: "This Jace account can't change its name right now." }, { status: 403 });
  }
  try {
    await profileStore().setDisplayName(session.user.id, cleaned.name);
  } catch {
    return NextResponse.json({ error: "Couldn't save. Try again in a moment." }, { status: 503 });
  }
  const user = { ...session.user, displayName: cleaned.name };
  const res = NextResponse.json({ user });
  setSessionCookie(res, { ...session, user });
  return res;
}

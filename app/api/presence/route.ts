import { NextResponse, type NextRequest } from "next/server";
import { socialConfigured, socialPresence } from "@/lib/jaceSocial";
import { getSession } from "@/lib/session";

/** { activity: "Playing Chess" | null } → shown to the player's Jace Social friends. Best effort. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session || !socialConfigured()) return NextResponse.json({ ok: false });
  const body = (await req.json().catch(() => null)) as { activity?: unknown } | null;
  const activity = typeof body?.activity === "string" ? `${body.activity.slice(0, 50)} on Jace Games` : null;
  try {
    await socialPresence(session.token, activity);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}

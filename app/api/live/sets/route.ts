import { NextResponse, type NextRequest } from "next/server";
import { liveStore } from "@/lib/db/live";
import { liveError } from "@/lib/live/http";
import { saveSet } from "@/lib/live/sets";
import { getSession } from "@/lib/session";

/** GET: my sets. POST: make a new set → { set }. */
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to see your sets." }, { status: 401 });
  try {
    return NextResponse.json({ sets: await liveStore().mySets(session.user.id) });
  } catch (e) {
    return liveError(e);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in with Jace to make sets." }, { status: 401 });
  try {
    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    return NextResponse.json({ set: await saveSet(session, null, body) });
  } catch (e) {
    return liveError(e);
  }
}

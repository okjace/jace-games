import { NextResponse, type NextRequest } from "next/server";
import { RoomError, createRoom } from "@/lib/rooms";
import { getSession } from "@/lib/session";
import "@/lib/studioRooms";

/** Creates a room for a game: { game } → { code }. Playing online needs a Jace account. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in with Jace to play with friends." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { game?: unknown; settings?: unknown } | null;
  if (!body || typeof body.game !== "string") return NextResponse.json({ error: "Send { game }." }, { status: 400 });
  try {
    const code = await createRoom(session, body.game, (body.settings as Record<string, unknown>) ?? {});
    return NextResponse.json({ code });
  } catch (e) {
    return roomErrorResponse(e);
  }
}

export function roomErrorResponse(e: unknown): NextResponse {
  if (e instanceof RoomError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}

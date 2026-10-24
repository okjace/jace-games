import { NextResponse, type NextRequest } from "next/server";
import { roomErrorResponse } from "@/app/api/rooms/route";
import { getRoomPayload, roomAction } from "@/lib/rooms";
import { getSession } from "@/lib/session";

/** The room as the signed-in person may see it. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/rooms/[code]">): Promise<NextResponse> {
  const { code } = await ctx.params;
  try {
    return NextResponse.json(await getRoomPayload(code, await getSession()), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return roomErrorResponse(e);
  }
}

/** { action: "join" | "leave" | "ready" | "start" | "move" | "result" | "finalize" | "end" | "rematch" | "kick", … } */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/rooms/[code]">): Promise<NextResponse> {
  const { code } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in with Jace to play with friends." }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.action !== "string") return NextResponse.json({ error: "Send { action }." }, { status: 400 });
  try {
    return NextResponse.json(await roomAction(code, session, body));
  } catch (e) {
    return roomErrorResponse(e);
  }
}

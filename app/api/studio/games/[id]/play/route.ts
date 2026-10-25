import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { addPlay, studioErrorResponse } from "@/lib/studio/server";

/** Counts a play (at most once per person per game every half hour). */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/studio/games/[id]/play">): Promise<NextResponse> {
  const { id } = await ctx.params;
  const session = await getSession();
  const who = session?.user.id ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "anon";
  try {
    await addPlay(id, who);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return studioErrorResponse(e);
  }
}

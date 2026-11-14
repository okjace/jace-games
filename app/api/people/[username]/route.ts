import { NextResponse, type NextRequest } from "next/server";
import { profileOf } from "@/lib/peopleServer";

/** GET → someone's public profile (404 if it's private or doesn't exist). */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/people/[username]">): Promise<NextResponse> {
  const { username } = await ctx.params;
  const p = await profileOf(decodeURIComponent(username));
  if (!p) return NextResponse.json({ error: "That profile is private or doesn't exist." }, { status: 404 });
  return NextResponse.json({ profile: p });
}

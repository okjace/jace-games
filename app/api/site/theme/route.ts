import { NextResponse, type NextRequest } from "next/server";
import { getThemeChoice, setThemeChoice } from "@/lib/db/siteSettings";
import { isSiteOwner } from "@/lib/owner";
import { activeSeason, isThemeChoice } from "@/lib/seasons";
import { getSession } from "@/lib/session";

/** The site theme: GET → { choice, active, auto, canEdit }. PUT { choice } (site owner only). */
export async function GET(): Promise<NextResponse> {
  const [choice, session] = await Promise.all([getThemeChoice(), getSession()]);
  return NextResponse.json({ choice, active: activeSeason(choice), auto: activeSeason("auto"), canEdit: !!session && isSiteOwner(session.user.id) });
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session || !isSiteOwner(session.user.id)) return NextResponse.json({ error: "Only the site owner can change the theme." }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { choice?: unknown } | null;
  if (!isThemeChoice(body?.choice)) return NextResponse.json({ error: "That isn't a theme." }, { status: 400 });
  await setThemeChoice(body.choice);
  return NextResponse.json({ choice: body.choice, active: activeSeason(body.choice) });
}

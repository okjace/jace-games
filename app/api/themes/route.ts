import { NextResponse, type NextRequest } from "next/server";
import { themeStore, type MarketSort } from "@/lib/db/themes";
import { allow } from "@/lib/rateLimit";
import { getSession } from "@/lib/session";
import { ThemeError, createTheme, summary } from "@/lib/themesServer";

/** GET ?sort=trending|popular|liked|new&q= → the theme market (+ which I liked). POST { data } → make a theme (signed in). */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const asked = req.nextUrl.searchParams.get("sort");
  const sort: MarketSort = asked === "new" || asked === "liked" || asked === "popular" ? asked : "trending";
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 40);
  const rows = await themeStore.market(sort, q);
  // Which ones I've liked (signed in).
  const session = await getSession();
  const liked = session ? [...(await themeStore.likedBy(session.user.id, rows.map((r) => r.id)).catch(() => new Set<string>()))] : [];
  return NextResponse.json({ themes: rows.map(summary), liked });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in w/ Jace to make themes." }, { status: 401 });
  if (!allow(`themes-new:${session.user.id}`, 10, 60_000)) return NextResponse.json({ error: "Slow down a little!" }, { status: 429 });
  try {
    const body = ((await req.json().catch(() => null)) ?? {}) as { data?: unknown };
    return NextResponse.json({ theme: await createTheme(session, body.data) });
  } catch (e) {
    if (e instanceof ThemeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

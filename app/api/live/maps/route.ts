import { NextResponse, type NextRequest } from "next/server";
import { mapStore, summarize } from "@/lib/db/liveMaps";
import { liveError } from "@/lib/live/http";
import { DEFAULT_MAP, cleanMap } from "@/lib/live/maps";
import { allow } from "@/lib/rateLimit";
import { getSession } from "@/lib/session";

/** GET: my maps and popular public maps. POST: make a new map (starts as a copy of the default). */
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  try {
    const [mine, pub] = await Promise.all([session ? mapStore().mine(session.user.id) : [], mapStore().publicMaps(30)]);
    return NextResponse.json({ mine: mine.map(summarize), public: pub.filter((m) => m.owner_id !== session?.user.id).map(summarize) });
  } catch (e) {
    return liveError(e);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in with Jace to make maps." }, { status: 401 });
  if (!allow(`live-map-create:${session.user.id}`, 20, 3_600_000)) return NextResponse.json({ error: "You've made a lot of maps this hour." }, { status: 429 });
  const body = ((await req.json().catch(() => null)) ?? {}) as { title?: unknown; data?: unknown };
  const cleaned = cleanMap(body.data ?? DEFAULT_MAP);
  if (!cleaned.ok) return NextResponse.json({ error: cleaned.error }, { status: 400 });
  try {
    const map = await mapStore().create({
      owner_id: session.user.id,
      owner_name: session.user.username,
      title: (typeof body.title === "string" ? body.title : "My map").trim().slice(0, 60) || "My map",
      data: cleaned.map,
      visibility: "private",
    });
    return NextResponse.json({ map });
  } catch (e) {
    return liveError(e);
  }
}

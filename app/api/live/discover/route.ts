import { NextResponse, type NextRequest } from "next/server";
import { liveStore } from "@/lib/db/live";
import { liveError } from "@/lib/live/http";

/** Public sets: ?q= search, ?tag=, ?sort=popular|new, ?page= */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const sp = req.nextUrl.searchParams;
  const page = Math.max(0, Math.min(50, Number(sp.get("page")) || 0));
  try {
    const sets = await liveStore().discover({
      q: (sp.get("q") ?? "").slice(0, 60) || undefined,
      tag: (sp.get("tag") ?? "").toLowerCase().slice(0, 24) || undefined,
      sort: sp.get("sort") === "new" ? "new" : "popular",
      limit: 24,
      offset: page * 24,
    });
    return NextResponse.json({ sets }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return liveError(e);
  }
}

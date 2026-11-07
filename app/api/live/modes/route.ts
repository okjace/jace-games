import { NextResponse } from "next/server";
import { studioStore } from "@/lib/db/studio";
import { liveError } from "@/lib/live/http";
import { getSession } from "@/lib/session";

/** Game Studio games hosts can pick as a Live mode: your own (drafts too) and published ones. */
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  try {
    const store = studioStore();
    const [mine, published] = await Promise.all([session ? store.gamesByOwner(session.user.id) : [], store.published(200)]);
    const pick = (g: (typeof published)[number]) => ({ id: g.id, title: g.title, icon: g.icon, owner_name: g.owner_name, plays: g.plays, published: g.published });
    return NextResponse.json({
      mine: mine.filter((g) => g.live_mode && !g.removed).map(pick),
      public: published.filter((g) => g.live_mode && !g.removed && g.owner_id !== session?.user.id).map(pick),
    });
  } catch (e) {
    return liveError(e);
  }
}

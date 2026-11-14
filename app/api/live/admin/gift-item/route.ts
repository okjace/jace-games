import { NextResponse, type NextRequest } from "next/server";
import { grantedOf, lockerStore } from "@/lib/db/liveLocker";
import { ITEM_KINDS, itemGrant, itemOf, type ItemKind } from "@/lib/live/locker";
import { isSiteOwner } from "@/lib/owner";
import { getSession } from "@/lib/session";

/** Site owner: POST { userId, kind, id, take? } gives someone a locker item (or takes it back). */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session || !isSiteOwner(session.user.id)) return NextResponse.json({ error: "Only the site owner can do this." }, { status: 403 });
  const body = ((await req.json().catch(() => null)) ?? {}) as { userId?: unknown; kind?: unknown; id?: unknown; take?: unknown };
  const kind = (ITEM_KINDS as readonly string[]).includes(String(body.kind)) ? (body.kind as ItemKind) : null;
  const item = kind && typeof body.id === "string" ? itemOf(kind, body.id) : undefined;
  if (typeof body.userId !== "string" || !body.userId || !kind || !item || !item.id) return NextResponse.json({ error: "Pick a person and an item." }, { status: 400 });
  const store = lockerStore();
  const row = await store.get(body.userId);
  const key = itemGrant(kind, item.id);
  const granted = grantedOf(row).filter((g) => g !== key);
  await store.setGranted(body.userId, body.take === true ? granted : [...granted, key]);
  return NextResponse.json({ ok: true, item: item.name, gave: body.take !== true });
}

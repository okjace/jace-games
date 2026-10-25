import { NextResponse } from "next/server";
import { SocialError, socialConfigured, socialFriends } from "@/lib/jaceSocial";
import { getSession } from "@/lib/session";

/** The signed-in player's Jace Social friends, for inviting them to rooms. */
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "signed_out" }, { status: 401 });
  if (!socialConfigured()) return NextResponse.json({ available: false });
  try {
    const { linked, friends } = await socialFriends(session.token);
    return NextResponse.json({
      available: true,
      linked,
      friends: friends.map((f) => ({
        uuid: f.uuid,
        name: f.name,
        handle: f.handle,
        picture: f.picture,
        status: f.status,
        activity: f.activity,
        // Only friends with a Jace account can sign in to Jace Games.
        canJoin: !!f.jace_sub,
        jaceId: f.jace_sub,
      })),
    });
  } catch (e) {
    if (e instanceof SocialError && e.code === "invalid_token") return NextResponse.json({ error: "signed_out" }, { status: 401 });
    console.error("Jace Social friends failed:", e);
    return NextResponse.json({ available: false, error: "unavailable" });
  }
}

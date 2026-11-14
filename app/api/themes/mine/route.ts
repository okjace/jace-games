import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { myThemes } from "@/lib/themesServer";

/** GET: the themes u made and the ones u installed. */
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ made: [], installed: [] }, { status: 401 });
  return NextResponse.json(await myThemes(session));
}

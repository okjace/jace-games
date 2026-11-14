import { NextResponse, type NextRequest } from "next/server";
import { findPeople } from "@/lib/peopleServer";

/** GET ?q= → public profiles (only people who made theirs public). */
export async function GET(req: NextRequest): Promise<NextResponse> {
  return NextResponse.json({ people: await findPeople((req.nextUrl.searchParams.get("q") ?? "").slice(0, 40)) });
}

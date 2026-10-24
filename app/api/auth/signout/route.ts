import { NextResponse, type NextRequest } from "next/server";
import { appOrigin } from "@/lib/routes";
import { clearSessionCookie } from "@/lib/session";

/** Signs out of Jace Games (the Jace account itself stays signed in on Jace). */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const res = NextResponse.redirect(new URL("/", appOrigin(req)), { status: 303 });
  clearSessionCookie(res);
  return res;
}

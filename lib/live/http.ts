import "server-only";
import { NextResponse } from "next/server";
import { LiveError } from "./engine";

/** Turns a thrown error into the JSON answer the Live pages expect. */
export function liveError(e: unknown): NextResponse {
  if (e instanceof LiveError) return NextResponse.json({ error: e.message, ...e.extra }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}

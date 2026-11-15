import "server-only";
import { createHash } from "node:crypto";
import { liveStore, type LiveGameRow, type LivePlayerRow } from "@/lib/db/live";
import { SocialError, socialConfigured, socialFriends, socialIce, type IceServer } from "@/lib/jaceSocial";
import { broadcast } from "@/lib/realtime/server";
import type { Session } from "@/lib/session";

/**
 * In-game voice calls: a call for the whole game and one per team. Nobody is
 * in one until they press join; you only ever connect to players who are your
 * Jace Social friends (checked here, on the server, for every message); the
 * host turns calls on. Voice goes straight between devices (WebRTC), through
 * Jace Social's relay when it has to. This server only passes the connection
 * setup along, each player on their own private channel.
 */

export type CallRoom = "game" | "team";
type CallData = { call?: { room: CallRoom; at: number } | null; team?: number };
export class CallError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** A player who hasn't checked in for this long has left the call (closed the tab…). */
const FRESH_MS = 25_000;
const sha = (s: string) => createHash("sha256").update(s).digest("base64url");
/** The private channel where a player gets call setup messages. */
export const callTopicOf = (g: LiveGameRow, playerId: string) => `jg-live:${sha(`${g.channel}:call:${playerId}`).slice(0, 24)}`;

const friendCache = new Map<string, { at: number; subs: Set<string> }>();
/** Jace user ids of the player's Jace Social friends (cached a minute). */
async function friendIds(session: Session): Promise<Set<string>> {
  const hit = friendCache.get(session.user.id);
  if (hit && Date.now() - hit.at < 60_000) return hit.subs;
  if (!socialConfigured()) return new Set();
  try {
    const { friends } = await socialFriends(session.token);
    const subs = new Set(friends.map((f) => f.jace_sub).filter((s): s is string => !!s));
    friendCache.set(session.user.id, { at: Date.now(), subs });
    if (friendCache.size > 2000) friendCache.clear();
    return subs;
  } catch (e) {
    if (e instanceof SocialError && e.code === "not_linked") throw new CallError("Open Jace Social once w/ ur Jace account to use calls (u can only call friends there).", 403);
    throw new CallError("Couldn't reach Jace Social right now.", 503);
  }
}

const dataOf = (p: LivePlayerRow) => (p.data ?? {}) as CallData;
const inCall = (p: LivePlayerRow, now: number) => {
  const c = dataOf(p).call;
  return c && now - c.at < FRESH_MS ? c : null;
};

async function me(g: LiveGameRow, session: Session | null): Promise<{ meRow: LivePlayerRow; all: LivePlayerRow[] }> {
  if (!session) throw new CallError("Sign in w/ Jace to use calls.", 401);
  const settings = g.settings as { calls?: boolean; solo?: boolean };
  if (settings.solo || settings.calls !== true) throw new CallError("The host hasn't turned calls on.", 403);
  if (g.status === "ended") throw new CallError("The game is over.", 409);
  const all = await liveStore().players(g.id);
  const meRow = all.find((p) => p.user_id === session.user.id);
  if (!meRow) throw new CallError("Join the game (signed in) to use calls.", 403);
  return { meRow, all };
}

/** Same call: the game call, or the same team's call. */
const sameRoom = (a: LivePlayerRow, b: LivePlayerRow, now: number) => {
  const ca = inCall(a, now);
  const cb = inCall(b, now);
  if (!ca || !cb || ca.room !== cb.room) return false;
  return ca.room === "game" || (dataOf(a).team !== undefined && dataOf(a).team === dataOf(b).team);
};

export type CallState = { on: boolean; mine: CallRoom | null; me: string; peers: { id: string; name: string }[]; inCallNotFriends: number; topic: string };

/** Where I am, and the friends in my call (also my check-in, so I stay in it). */
export async function callState(g: LiveGameRow, session: Session | null, beat: boolean): Promise<CallState> {
  const { meRow, all } = await me(g, session);
  const now = Date.now();
  let mine = inCall(meRow, now);
  if (beat && mine) {
    await liveStore().updatePlayer(g.id, meRow.id, { data: { ...meRow.data, call: { room: mine.room, at: now } } });
    mine = { room: mine.room, at: now };
    meRow.data = { ...meRow.data, call: mine };
  }
  const friends = mine ? await friendIds(session!) : new Set<string>();
  const together = all.filter((p) => p.id !== meRow.id && mine && sameRoom(meRow, p, now));
  const peers = together.filter((p) => p.user_id && friends.has(p.user_id)).map((p) => ({ id: p.id, name: p.name }));
  return { on: true, mine: mine?.room ?? null, me: meRow.id, peers, inCallNotFriends: together.length - peers.length, topic: callTopicOf(g, meRow.id) };
}

export async function callJoin(g: LiveGameRow, session: Session | null, room: unknown): Promise<CallState> {
  const { meRow } = await me(g, session);
  const r: CallRoom = room === "team" ? "team" : "game";
  if (r === "team" && dataOf(meRow).team === undefined) throw new CallError("Ur not on a team.", 409);
  await friendIds(session!); // linked to Jace Social? (explains why not, if not)
  await liveStore().updatePlayer(g.id, meRow.id, { data: { ...meRow.data, call: { room: r, at: Date.now() } } });
  return callState(await liveStore().gameByCode(g.code).then((x) => x ?? g), session, false);
}

export async function callLeave(g: LiveGameRow, session: Session | null): Promise<void> {
  if (!session) return;
  const all = await liveStore().players(g.id);
  const meRow = all.find((p) => p.user_id === session.user.id);
  if (meRow && dataOf(meRow).call) await liveStore().updatePlayer(g.id, meRow.id, { data: { ...meRow.data, call: null } });
}

/** Passes one connection message to a friend in the same call (checked here, so nobody else can be reached). */
export async function callSignal(g: LiveGameRow, session: Session | null, raw: unknown): Promise<void> {
  const { meRow, all } = await me(g, session);
  const m = (raw ?? {}) as { to?: unknown; kind?: unknown; sdp?: unknown };
  const to = all.find((p) => p.id === m.to);
  const kind = m.kind === "offer" || m.kind === "answer" || m.kind === "bye" ? m.kind : null;
  if (!to || !kind) throw new CallError("Bad call message.");
  const sdp = kind === "bye" ? null : typeof m.sdp === "string" && m.sdp.startsWith("v=0") && m.sdp.length < 30_000 ? m.sdp : null;
  if (kind !== "bye" && !sdp) throw new CallError("Bad call message.");
  const now = Date.now();
  if (kind !== "bye") {
    if (!sameRoom(meRow, to, now)) throw new CallError("They're not in ur call.", 409);
    const friends = await friendIds(session!);
    if (!to.user_id || !friends.has(to.user_id)) throw new CallError("U can only call ur Jace Social friends.", 403);
  }
  await broadcast(callTopicOf(g, to.id), "call-signal", { from: meRow.id, name: meRow.name, kind, sdp });
}

/** Relay servers for the call (Jace Social's), or just public STUN if it isn't reachable. */
export async function callIce(session: Session): Promise<IceServer[]> {
  const fallback: IceServer[] = [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }];
  if (!socialConfigured()) return fallback;
  return socialIce(session.token).catch(() => fallback);
}

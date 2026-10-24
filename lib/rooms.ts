import "server-only";
import { randomBytes, randomInt } from "crypto";
import { getGame, type MultiMode } from "./games";
import { roomStore, type PlayerRow, type RoomRow } from "./db/rooms";
import { RULES } from "./multiplayer/registry";
import { mixSeed, seededRandom } from "./multiplayer/rng";
import { isError, type Ctx, type Rules } from "./multiplayer/types";
import { broadcast } from "./realtime/server";
import type { Session } from "./session";
import { checkScore } from "./validate";

/**
 * Multiplayer rooms. A room is created from a game page, joined at
 * /r/<code>, and moves lobby → playing → done (→ lobby again on rematch).
 * The server is the referee: it seats players, checks every turn-based move
 * with the game's rules module, checks race results against the game's
 * score limits, and decides placements. After every change it broadcasts a
 * "room" event on the room's secret channel and clients re-fetch.
 */

export class RoomError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_ROOMS_PER_HOUR = 30;

export type RoomGame = {
  id: string;
  name: string;
  mode: MultiMode;
  min: number;
  max: number;
  timeLimitSec?: number;
  better: "higher" | "lower";
};

/** Built-in games here; community games (prefixed "c:") are resolved by the studio. */
export type GameResolver = (id: string) => Promise<RoomGame | null>;
const resolvers: GameResolver[] = [];
export function registerGameResolver(r: GameResolver) {
  resolvers.push(r);
}

export async function resolveGame(id: string): Promise<RoomGame | null> {
  const g = getGame(id);
  if (g?.multiplayer) {
    return { id: g.id, name: g.name, mode: g.multiplayer.mode, min: g.multiplayer.min, max: g.multiplayer.max, timeLimitSec: g.multiplayer.timeLimitSec, better: g.better };
  }
  for (const r of resolvers) {
    const found = await r(id);
    if (found) return found;
  }
  return null;
}

const newCode = () => Array.from({ length: 6 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join("");
const topicOf = (room: RoomRow) => `jg-room:${room.channel}`;

function ctxFor(room: RoomRow, salt: number): Ctx {
  return { now: Date.now(), rng: seededRandom(mixSeed(Number(room.seed), room.version * 7919 + salt)) };
}

function rulesFor(room: RoomRow): Rules | null {
  return room.mode === "turns" ? (RULES[room.game] ?? null) : null;
}

async function touch(room: RoomRow) {
  await broadcast(topicOf(room), "room", { version: room.version });
}

// ---------- Reading ----------

export type RoomPayload = {
  room: {
    code: string;
    game: string;
    gameName: string;
    mode: MultiMode;
    status: RoomRow["status"];
    host: string;
    seed: number;
    minPlayers: number;
    maxPlayers: number;
    settings: Record<string, unknown>;
    deadline: string | null;
    outcome: Outcome | null;
    version: number;
  };
  players: {
    userId: string;
    username: string;
    picture: string | null;
    seat: number;
    ready: boolean;
    left: boolean;
    finished: boolean;
    result: { score?: number; dnf?: boolean } | null;
  }[];
  me: { userId: string; seat: number } | null;
  /** The secret live channel; members only. */
  topic: string | null;
  /** Turn-based games: what I'm allowed to see, and whose turn it is. */
  view: unknown;
  turn: number[] | null;
  serverNow: number;
};

export type Outcome = {
  placements: { userId: string; username: string; seat: number; placement: number; score?: number; dnf?: boolean }[];
  reason?: string;
};

export async function getRoomPayload(code: string, session: Session | null): Promise<RoomPayload> {
  const store = roomStore();
  const room = await store.roomByCode(code.toUpperCase());
  if (!room) throw new RoomError("That room doesn't exist or has expired.", 404);
  const players = await store.players(room.id);
  return payload(room, players, session?.user.id ?? null);
}

function payload(room: RoomRow, players: PlayerRow[], userId: string | null): RoomPayload {
  const mine = players.find((p) => p.user_id === userId && !p.left_at) ?? null;
  const rules = rulesFor(room);
  const done = room.status === "done";
  const status = rules && room.state ? rules.status(room.state) : null;
  return {
    room: {
      code: room.code,
      game: room.game,
      gameName: getGame(room.game)?.name ?? String(room.settings.name ?? room.game),
      mode: room.mode,
      status: room.status,
      host: room.host,
      seed: Number(room.seed),
      minPlayers: room.min_players,
      maxPlayers: room.max_players,
      settings: room.settings,
      deadline: room.deadline,
      outcome: (room.outcome as Outcome) ?? null,
      version: room.version,
    },
    players: players.map((p) => {
      const r = p.result as { score?: number; dnf?: boolean } | null;
      return {
        userId: p.user_id,
        username: p.username,
        picture: p.picture,
        seat: p.seat,
        ready: p.ready,
        left: !!p.left_at,
        finished: !!r,
        // Race results stay hidden until everyone's done.
        result: done || p.user_id === userId ? r : null,
      };
    }),
    me: mine ? { userId: mine.user_id, seat: mine.seat } : null,
    topic: mine ? topicOf(room) : null,
    view: rules && room.state && (mine || done) ? rules.view(room.state, mine ? mine.seat : null) : null,
    turn: status && !status.over ? status.turn : null,
    serverNow: Date.now(),
  };
}

// ---------- Changing ----------

export async function createRoom(session: Session, gameId: string, settings: Record<string, unknown> = {}): Promise<string> {
  const game = await resolveGame(gameId);
  if (!game) throw new RoomError("That game can't be played with friends.");
  const store = roomStore();
  const since = new Date(Date.now() - 3_600_000).toISOString();
  if ((await store.countRoomsByHostSince(session.user.id, since)) >= MAX_ROOMS_PER_HOUR) {
    throw new RoomError("You've made a lot of rooms. Try again in a bit.", 429);
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const room = await store.createRoom({
        code: newCode(),
        game: game.id,
        mode: game.mode,
        host: session.user.id,
        seed: randomInt(1, 2 ** 31),
        channel: randomBytes(18).toString("base64url"),
        min_players: game.min,
        max_players: game.max,
        settings: { ...cleanSettings(settings), name: game.name, timeLimitSec: game.timeLimitSec ?? null, better: game.better },
      });
      await store.addPlayer({ room_id: room.id, user_id: session.user.id, username: session.user.username, picture: session.user.picture, seat: 0 });
      return room.code;
    } catch (e) {
      if (attempt === 4) throw e;
    }
  }
  throw new RoomError("Couldn't make a room.");
}

function cleanSettings(s: Record<string, unknown>): Record<string, unknown> {
  // Only small, known settings from the browser.
  const out: Record<string, unknown> = {};
  if (typeof s.private === "boolean") out.private = s.private;
  return out;
}

type Action =
  | { action: "join" }
  | { action: "leave" }
  | { action: "ready"; ready: boolean }
  | { action: "start" }
  | { action: "move"; move: unknown; version: number }
  | { action: "result"; score?: number; durationMs?: number; dnf?: boolean }
  | { action: "finalize" }
  | { action: "end"; winners: number[]; scores?: Record<string, number> }
  | { action: "rematch" }
  | { action: "kick"; userId: string };

export async function roomAction(code: string, session: Session, body: Action): Promise<RoomPayload> {
  const store = roomStore();
  const room = await store.roomByCode(code.toUpperCase());
  if (!room) throw new RoomError("That room doesn't exist or has expired.", 404);
  let players = await store.players(room.id);
  const me = players.find((p) => p.user_id === session.user.id) ?? null;
  const active = () => players.filter((p) => !p.left_at);
  const isHost = room.host === session.user.id;
  let changed: RoomRow | null = room;

  const bump = async (patch: Partial<RoomRow> = {}, expect?: number) => {
    const next = await store.updateRoom(room.id, { ...patch, version: room.version + 1 }, expect ?? room.version);
    if (!next) throw new RoomError("Someone else changed the room first. Try again.", 409);
    changed = next;
    return next;
  };

  switch (body.action) {
    case "join": {
      if (me && !me.left_at) break;
      if (room.status !== "lobby") throw new RoomError("This game has already started.", 409);
      if (active().length >= room.max_players) throw new RoomError("This room is full.", 409);
      if (me) await store.removePlayer(room.id, me.user_id);
      const taken = new Set(active().map((p) => p.seat));
      let seat = 0;
      while (taken.has(seat)) seat++;
      await store.addPlayer({ room_id: room.id, user_id: session.user.id, username: session.user.username, picture: session.user.picture, seat });
      await bump();
      break;
    }
    case "leave": {
      if (!me || me.left_at) break;
      if (room.status === "lobby" || room.status === "done") {
        await store.removePlayer(room.id, me.user_id);
        players = players.filter((p) => p.user_id !== me.user_id);
        if (active().length === 0) {
          await store.deleteRoom(room.id);
          await broadcast(topicOf(room), "room", { deleted: true });
          return payload(room, [], null);
        }
        await bump(isHost ? { host: active()[0].user_id } : {});
      } else {
        await store.updatePlayer(room.id, me.user_id, { left_at: new Date().toISOString() });
        players = players.map((p) => (p.user_id === me.user_id ? { ...p, left_at: new Date().toISOString() } : p));
        await handleLeaveDuringGame(room, players, me, bump);
      }
      break;
    }
    case "ready": {
      requireMember(me);
      if (room.status !== "lobby") break;
      await store.updatePlayer(room.id, me!.user_id, { ready: !!body.ready });
      await bump();
      break;
    }
    case "kick": {
      if (!isHost) throw new RoomError("Only the host can do that.", 403);
      if (room.status !== "lobby" || body.userId === session.user.id) break;
      await store.removePlayer(room.id, body.userId);
      await bump();
      break;
    }
    case "start": {
      if (!isHost) throw new RoomError("Only the host can start.", 403);
      if (room.status !== "lobby") break;
      const list = active();
      if (list.length < room.min_players) throw new RoomError(`This game needs at least ${room.min_players} players.`);
      // Seats become 0..n-1 in join order so rules modules see a tight range.
      const ordered = [...list].sort((a, b) => a.seat - b.seat);
      for (let i = 0; i < ordered.length; i++) {
        if (ordered[i].seat !== i) await store.updatePlayer(room.id, ordered[i].user_id, { seat: 1000 + i });
      }
      for (let i = 0; i < ordered.length; i++) {
        if (ordered[i].seat !== i) await store.updatePlayer(room.id, ordered[i].user_id, { seat: i });
      }
      await store.updatePlayers(room.id, { result: null });
      const rules = rulesFor(room);
      const limit = Number(room.settings.timeLimitSec) || 0;
      const now = Date.now();
      await bump({
        status: "playing",
        started_at: new Date(now).toISOString(),
        state: rules ? rules.init(ordered.length, ctxFor(room, 1)) : null,
        deadline: room.mode === "race" && limit ? new Date(now + (limit + 3) * 1000).toISOString() : null,
        outcome: null,
        ended_at: null,
      });
      break;
    }
    case "move": {
      requireMember(me);
      const rules = rulesFor(room);
      if (!rules || room.status !== "playing") throw new RoomError("You can't move right now.", 409);
      if (body.version !== room.version) throw new RoomError("The game moved on. Refreshing…", 409);
      const next = rules.apply(room.state, me!.seat, body.move, ctxFor(room, 2));
      if (isError(next)) throw new RoomError(next.error, 422);
      const status = rules.status(next);
      const updated = await bump({ state: next as RoomRow["state"] });
      if (status.over) await finishTurns(updated, players, status.winners);
      break;
    }
    case "result": {
      requireMember(me);
      if (room.mode !== "race" || room.status !== "playing") break;
      if (me!.result) break; // one attempt per race
      let result: { score?: number; dnf?: boolean; durationMs?: number };
      if (body.dnf) result = { dnf: true };
      else {
        const why = room.game.startsWith("c:") ? checkCommunityScore(body.score) : checkScore(room.game, body.score, body.durationMs);
        if (why) throw new RoomError(why, 422);
        result = { score: body.score, durationMs: body.durationMs };
      }
      await store.updatePlayer(room.id, me!.user_id, { result });
      players = players.map((p) => (p.user_id === me!.user_id ? { ...p, result } : p));
      const updated = await bump();
      if (active().every((p) => p.result)) await finishRace(updated, players);
      break;
    }
    case "finalize": {
      requireMember(me);
      if (room.mode !== "race" || room.status !== "playing" || !room.deadline) break;
      if (Date.now() < Date.parse(room.deadline)) throw new RoomError("Time isn't up yet.", 409);
      const updated = await bump();
      await finishRace(updated, players.map((p) => (p.result ? p : { ...p, result: { dnf: true } })));
      break;
    }
    case "end": {
      // Live games: the host's browser runs the game and reports who won.
      if (!isHost) throw new RoomError("Only the host can end the game.", 403);
      if (room.mode !== "live" || room.status !== "playing") break;
      const seats = new Set(active().map((p) => p.seat));
      const winners = (Array.isArray(body.winners) ? body.winners : []).filter((s) => Number.isInteger(s) && seats.has(s));
      const updated = await bump();
      await finishTurns(updated, players, winners, body.scores);
      break;
    }
    case "rematch": {
      if (!isHost) throw new RoomError("Only the host can start a rematch.", 403);
      if (room.status !== "done") break;
      for (const p of players) if (p.left_at) await store.removePlayer(room.id, p.user_id);
      await store.updatePlayers(room.id, { ready: false, result: null });
      await bump({ status: "lobby", seed: randomInt(1, 2 ** 31), state: null, outcome: null, deadline: null, started_at: null, ended_at: null });
      break;
    }
    default:
      throw new RoomError("Unknown action.");
  }

  if (changed) await touch(changed);
  const fresh = await store.roomByCode(room.code);
  return payload(fresh ?? room, await store.players(room.id), session.user.id);
}

function requireMember(me: PlayerRow | null) {
  if (!me || me.left_at) throw new RoomError("You're not in this room.", 403);
}

function checkCommunityScore(score: unknown): string | null {
  return typeof score === "number" && Number.isInteger(score) && Math.abs(score) <= 1e9 ? null : "Invalid score.";
}

async function handleLeaveDuringGame(
  room: RoomRow,
  players: PlayerRow[],
  leaver: PlayerRow,
  bump: (patch?: Partial<RoomRow>) => Promise<RoomRow>,
) {
  const remaining = players.filter((p) => !p.left_at);
  if (room.mode === "race") {
    const updated = await bump();
    if (remaining.length === 0) await finishRace(updated, players.map((p) => (p.result ? p : { ...p, result: { dnf: true } })), "Everyone left.");
    else if (remaining.every((p) => p.result)) await finishRace(updated, players);
    return;
  }
  if (room.mode === "live" && leaver.user_id === room.host) {
    const updated = await bump();
    await finishTurns(updated, players, [], undefined, "The host left.");
    return;
  }
  // Turn-based (and live with the host still here): the leaver forfeits.
  const updated = await bump();
  if (remaining.length <= 1) {
    await finishTurns(updated, players, remaining.map((p) => p.seat), undefined, `${leaver.username} left.`);
  } else if (room.mode === "turns") {
    const rules = rulesFor(room);
    const forfeit = (rules as Rules & { forfeit?: (s: unknown, seat: number, ctx: Ctx) => unknown })?.forfeit;
    if (forfeit && room.state) {
      const next = forfeit(room.state, leaver.seat, ctxFor(room, 3));
      const after = await roomStore().updateRoom(room.id, { state: next as RoomRow["state"], version: updated.version + 1 }, updated.version);
      if (after && rules!.status(next).over) {
        const st = rules!.status(next) as { over: true; winners: number[] };
        await finishTurns(after, players, st.winners);
      }
    } else {
      await finishTurns(updated, players, remaining.map((p) => p.seat), undefined, `${leaver.username} left.`);
    }
  }
}

async function finishTurns(room: RoomRow, players: PlayerRow[], winners: number[], scores?: Record<string, number>, reason?: string) {
  const placements = players.map((p) => ({
    userId: p.user_id,
    username: p.username,
    seat: p.seat,
    placement: winners.includes(p.seat) ? 1 : winners.length ? 2 : 1,
    ...(scores && typeof scores[String(p.seat)] === "number" ? { score: scores[String(p.seat)] } : {}),
    ...(p.left_at ? { dnf: true } : {}),
  }));
  // A draw (no winners) gives everyone placement 1 but nobody a win.
  await done(room, placements, winners.length > 0, reason);
}

async function finishRace(room: RoomRow, players: PlayerRow[], reason?: string) {
  const better = room.settings.better === "lower" ? "lower" : "higher";
  const scored = players.map((p) => {
    const r = (p.result ?? { dnf: true }) as { score?: number; dnf?: boolean };
    return { p, score: r.dnf || p.left_at ? null : (r.score ?? null) };
  });
  const ranked = [...scored].sort((a, b) => {
    if (a.score === null) return b.score === null ? 0 : 1;
    if (b.score === null) return -1;
    return better === "higher" ? b.score - a.score : a.score - b.score;
  });
  const placements: Outcome["placements"] = [];
  ranked.forEach((r, i) => {
    const prev = ranked[i - 1];
    const placement =
      i > 0 && prev.score === r.score ? placements[i - 1].placement : i + 1;
    placements.push({
      userId: r.p.user_id,
      username: r.p.username,
      seat: r.p.seat,
      placement,
      ...(r.score === null ? { dnf: true } : { score: r.score }),
    });
  });
  const anyScore = scored.some((s) => s.score !== null);
  await done(room, placements, anyScore, reason);
}

async function done(room: RoomRow, placements: Outcome["placements"], hasWinner: boolean, reason?: string) {
  const store = roomStore();
  const updated = await store.updateRoom(
    room.id,
    { status: "done", outcome: { placements, ...(reason ? { reason } : {}) }, ended_at: new Date().toISOString(), version: room.version + 1 },
    room.version,
  );
  if (!updated) return; // someone else finished it first
  if (placements.length >= 2) {
    await store.addResults(
      placements.map((p) => ({
        room_id: room.id,
        game: room.game,
        user_id: p.userId,
        username: p.username,
        placement: p.placement,
        players: placements.length,
        won: hasWinner && p.placement === 1 && !p.dnf,
      })),
    );
  }
}

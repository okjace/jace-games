import "server-only";
import { createHash, randomBytes, randomInt } from "crypto";
import { liveStore, type LiveGameRow, type LivePlayerRow } from "@/lib/db/live";
import { broadcast } from "@/lib/realtime/server";
import type { Session } from "@/lib/session";
import { MODES, cleanName, forPlayers, isCorrect, isPlayable, type LiveMode, type PlayerQuestion, type Question } from "./types";

/**
 * Jace Games Live, on the server. The host runs the game from a Jace
 * account; players join with the 6-digit code and a nickname and get a
 * secret token (kept in their browser) that identifies them afterwards.
 * Every answer is checked here, so correct answers never reach players
 * before the reveal. Live pushes (question started, revealed, ended) go
 * over a secret Realtime channel only joined players and the host know.
 */

export class LiveError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const MAX_PLAYERS = 200;
const MAX_GAMES_PER_HOUR = 30;
const GRACE_MS = 1500; // answers can arrive a little after the timer on slow connections
const TAP_COOLDOWN_MS = { gold: 1200, rocket: 650 };
const ROCKET_GOAL = 100;

export type GameSettings = { noSet: boolean; minutes: number; shuffle: boolean };

/**
 * Classic: lobby → question → reveal → question … → ended (q indexes `order`).
 * Gold Rush / Rocket Race: lobby → running → ended.
 */
type State = {
  phase: "lobby" | "question" | "reveal" | "running" | "ended";
  q?: number;
  order?: number[];
  startedAt?: number;
  endsAt?: number;
  winner?: string;
};

type ClassicAnswer = { a: unknown; correct: boolean; pts: number; at: number };
type Chest = { kind: "gain" | "double" | "steal" | "swap" | "lose" | "nothing"; amount: number };
type PlayerData = {
  answers?: Record<string, ClassicAnswer>;
  cur?: { qi: number; issuedAt: number } | null;
  chests?: Chest[] | null;
  lastTap?: number;
  recent?: number[];
  last?: Record<string, unknown> | null;
};

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const topicOf = (g: LiveGameRow) => `jg-live:${g.channel}`;
const stateOf = (g: LiveGameRow) => g.state as State;
const dataOf = (p: LivePlayerRow) => (p.data ?? {}) as PlayerData;
const questionsOf = (g: LiveGameRow) => (g.questions ?? []) as Question[];

async function getGame(code: string): Promise<LiveGameRow> {
  if (!/^\d{6}$/.test(code)) throw new LiveError("That code doesn't look right.", 404);
  const g = await liveStore().gameByCode(code);
  if (!g) throw new LiveError("No game with that code. Check it with your host.", 404);
  return g;
}

function ranked(players: LivePlayerRow[]): LivePlayerRow[] {
  return [...players].sort((a, b) => b.score - a.score || (a.finished_at ?? "~").localeCompare(b.finished_at ?? "~") || a.joined_at.localeCompare(b.joined_at));
}

/** What every client is told when the game moves on (no answers in it). */
async function push(g: LiveGameRow, event = "phase", extra: Record<string, unknown> = {}) {
  const s = stateOf(g);
  const qs = questionsOf(g);
  const current = g.mode === "classic" && s.phase === "question" && s.order ? qs[s.order[s.q!]] : null;
  await broadcast(topicOf(g), event, {
    version: g.version,
    status: g.status,
    phase: s.phase,
    q: s.q ?? null,
    total: s.order?.length ?? qs.length,
    endsAt: s.endsAt ?? null,
    question: current ? forPlayers(current) : null,
    serverNow: Date.now(),
    ...extra,
  });
}

async function bump(g: LiveGameRow, patch: Partial<LiveGameRow>): Promise<LiveGameRow> {
  const next = await liveStore().updateGame(g.id, { ...patch, version: g.version + 1 }, g.version);
  if (!next) throw new LiveError("The game changed at the same moment. Try again.", 409);
  return next;
}

// ---------- Creating and joining ----------

export async function createLiveGame(
  session: Session,
  opts: { setId: string | null; mode: LiveMode; settings: Partial<GameSettings> },
): Promise<string> {
  const mode = MODES[opts.mode] ? opts.mode : "classic";
  const store = liveStore();
  const since = new Date(Date.now() - 3_600_000).toISOString();
  if ((await store.countGamesByHostSince(session.user.id, since)) >= MAX_GAMES_PER_HOUR) {
    throw new LiveError("You've hosted a lot of games this hour. Try again in a bit.", 429);
  }
  const noSet = !opts.setId;
  if (noSet && MODES[mode].needsSet) throw new LiveError(`${MODES[mode].name} needs a question set.`);
  let questions: Question[] | null = null;
  let setTitle: string | null = null;
  if (opts.setId) {
    const set = await store.getSet(opts.setId);
    const canUse = set && !set.removed && (set.visibility !== "private" || set.owner_id === session.user.id);
    if (!set || !canUse) throw new LiveError("That set isn't available.", 404);
    questions = set.questions.filter(isPlayable);
    if (questions.length === 0) throw new LiveError("That set has no finished questions yet.");
    setTitle = set.title;
  }
  const settings: GameSettings = {
    noSet,
    minutes: Math.min(30, Math.max(1, Math.round(Number(opts.settings.minutes) || 5))),
    shuffle: !!opts.settings.shuffle,
  };
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const g = await store.createGame({
        code: String(randomInt(100000, 1000000)),
        host_id: session.user.id,
        host_name: session.user.username,
        set_id: opts.setId,
        set_title: setTitle,
        questions,
        mode,
        settings,
        channel: randomBytes(18).toString("base64url"),
      });
      await store.updateGame(g.id, { state: { phase: "lobby" } });
      if (opts.setId) await store.addPlay(opts.setId);
      return g.code;
    } catch (e) {
      if (attempt === 5) throw e;
    }
  }
  throw new LiveError("Couldn't start a game.");
}

export async function joinLiveGame(code: string, rawName: unknown, session: Session | null): Promise<{ token: string; playerId: string }> {
  const g = await getGame(code);
  if (g.status === "ended") throw new LiveError("That game has ended.", 409);
  const name = cleanName(rawName ?? session?.user.username);
  if (!name) throw new LiveError("Pick a nickname.");
  const store = liveStore();
  const players = await store.players(g.id);
  if (players.length >= MAX_PLAYERS) throw new LiveError("This game is full.", 409);
  const token = randomBytes(24).toString("base64url");
  const added = await store.addPlayer({ game_id: g.id, name, user_id: session?.user.id ?? null, token_hash: sha(token) });
  if (added === "name_taken") throw new LiveError("Someone already has that name here. Try another.", 409);
  await push(g, "players");
  return { token, playerId: added.id };
}

async function playerFor(g: LiveGameRow, token: unknown): Promise<LivePlayerRow> {
  if (typeof token !== "string" || token.length < 20) throw new LiveError("Join the game first.", 401);
  const p = await liveStore().playerByToken(g.id, sha(token));
  if (!p) throw new LiveError("You're not in this game (maybe the host removed you).", 401);
  return p;
}

// ---------- Views ----------

export type HostView = {
  code: string;
  mode: LiveMode;
  status: LiveGameRow["status"];
  setTitle: string | null;
  settings: GameSettings;
  state: State;
  topic: string;
  questionCount: number;
  current: (Question & { index: number }) | null;
  counts: number[] | null;
  answeredCount: number;
  players: { id: string; name: string; score: number; correct: number; answered: number; streak: number; finished: boolean }[];
  serverNow: number;
};

export async function hostView(code: string, session: Session): Promise<HostView> {
  const g = await getGame(code);
  if (g.host_id !== session.user.id) throw new LiveError("Only the host can see this.", 403);
  const s = stateOf(g);
  const players = ranked(await liveStore().players(g.id));
  const qs = questionsOf(g);
  const current = g.mode === "classic" && s.order && (s.phase === "question" || s.phase === "reveal") ? { ...qs[s.order[s.q!]], index: s.q! } : null;
  let counts: number[] | null = null;
  let answeredCount = 0;
  if (current) {
    const key = String(current.index);
    const answers = players.map((p) => dataOf(p).answers?.[key]).filter(Boolean) as ClassicAnswer[];
    answeredCount = answers.length;
    if (current.type === "choice" || current.type === "truefalse") {
      counts = (current.choices ?? []).map((_, i) => answers.filter((a) => a.a === i).length);
    }
  }
  return {
    code: g.code,
    mode: g.mode,
    status: g.status,
    setTitle: g.set_title,
    settings: g.settings as GameSettings,
    state: s,
    topic: topicOf(g),
    questionCount: s.order?.length ?? qs.length,
    current,
    counts,
    answeredCount,
    players: players.map((p) => ({ id: p.id, name: p.name, score: p.score, correct: p.correct, answered: p.answered, streak: p.streak, finished: !!p.finished_at })),
    serverNow: Date.now(),
  };
}

export type PlayerView = {
  code: string;
  mode: LiveMode;
  status: LiveGameRow["status"];
  noSet: boolean;
  phase: string;
  topic: string;
  me: { id: string; name: string; score: number; rank: number; streak: number; correct: number; answered: number };
  playerCount: number;
  top: { name: string; score: number; you: boolean }[];
  endsAt: number | null;
  /** Classic: the question being played (no answers), what I answered, and at reveal the right answer. */
  question: (PlayerQuestion & { index: number; total: number }) | null;
  myAnswer: ClassicAnswer | null;
  reveal: { correct?: number[]; accepted?: string[] } | null;
  /** Gold Rush / Rocket Race: my current question, and chests to pick from. */
  selfQuestion: PlayerQuestion | null;
  chests: number | null;
  last: Record<string, unknown> | null;
  serverNow: number;
};

export async function playerView(code: string, token: unknown): Promise<PlayerView> {
  const g = await getGame(code);
  const me = await playerFor(g, token);
  return buildPlayerView(g, me, await liveStore().players(g.id));
}

function buildPlayerView(g: LiveGameRow, me: LivePlayerRow, all: LivePlayerRow[]): PlayerView {
  const s = stateOf(g);
  const qs = questionsOf(g);
  const sorted = ranked(all);
  const rank = sorted.findIndex((p) => p.id === me.id) + 1;
  const d = dataOf(me);
  const classicQ = g.mode === "classic" && s.order && (s.phase === "question" || s.phase === "reveal") ? qs[s.order[s.q!]] : null;
  const settings = g.settings as GameSettings;
  return {
    code: g.code,
    mode: g.mode,
    status: g.status,
    noSet: !!settings.noSet,
    phase: s.phase,
    topic: topicOf(g),
    me: { id: me.id, name: me.name, score: me.score, rank, streak: me.streak, correct: me.correct, answered: me.answered },
    playerCount: all.length,
    top: sorted.slice(0, 5).map((p) => ({ name: p.name, score: p.score, you: p.id === me.id })),
    endsAt: s.endsAt ?? null,
    question: classicQ ? { ...forPlayers(classicQ), index: s.q!, total: s.order!.length } : null,
    myAnswer: classicQ ? (d.answers?.[String(s.q)] ?? null) : null,
    reveal: classicQ && s.phase === "reveal" ? { correct: classicQ.correct, accepted: classicQ.accepted } : null,
    selfQuestion: g.mode !== "classic" && d.cur && qs[d.cur.qi] && g.status === "playing" ? forPlayers(qs[d.cur.qi]) : null,
    chests: d.chests ? d.chests.length : null,
    last: d.last ?? null,
    serverNow: Date.now(),
  };
}

// ---------- Host actions ----------

type HostAction = { action: "start" } | { action: "next" } | { action: "reveal" } | { action: "end" } | { action: "kick"; playerId: string } | { action: "tick" };

export async function hostAction(code: string, session: Session, body: HostAction): Promise<void> {
  const g = await getGame(code);
  if (g.host_id !== session.user.id) throw new LiveError("Only the host can do that.", 403);
  const s = stateOf(g);
  const now = Date.now();
  const qs = questionsOf(g);
  const settings = g.settings as GameSettings;

  switch (body.action) {
    case "start": {
      if (g.status !== "lobby") return;
      if ((await liveStore().players(g.id)).length === 0) throw new LiveError("Wait for someone to join.");
      if (g.mode === "classic") {
        const order = qs.map((_, i) => i);
        if (settings.shuffle) for (let i = order.length - 1; i > 0; i--) { const j = randomInt(i + 1); [order[i], order[j]] = [order[j], order[i]]; }
        const first = qs[order[0]];
        const next = await bump(g, { status: "playing", started_at: new Date(now).toISOString(), state: { phase: "question", q: 0, order, startedAt: now, endsAt: now + first.time * 1000 } });
        await push(next);
      } else {
        const next = await bump(g, { status: "playing", started_at: new Date(now).toISOString(), state: { phase: "running", startedAt: now, endsAt: now + settings.minutes * 60_000 } });
        await push(next);
      }
      return;
    }
    case "reveal": {
      if (g.mode !== "classic" || s.phase !== "question") return;
      await push(await bump(g, { state: { ...s, phase: "reveal" } }));
      return;
    }
    case "next": {
      if (g.mode !== "classic" || s.phase !== "reveal") return;
      const q = s.q! + 1;
      if (q >= s.order!.length) {
        await push(await bump(g, { status: "ended", ended_at: new Date(now).toISOString(), state: { ...s, phase: "ended" } }));
        return;
      }
      const question = qs[s.order![q]];
      await push(await bump(g, { state: { ...s, phase: "question", q, startedAt: now, endsAt: now + question.time * 1000 } }));
      return;
    }
    case "tick": {
      // The host's screen nudges the server when a timer runs out.
      if (g.mode === "classic" && s.phase === "question" && now >= (s.endsAt ?? 0)) await push(await bump(g, { state: { ...s, phase: "reveal" } }));
      else if (g.mode !== "classic" && s.phase === "running" && now >= (s.endsAt ?? 0)) await endGame(g);
      return;
    }
    case "end": {
      if (g.status === "ended") return;
      await endGame(g);
      return;
    }
    case "kick": {
      if (typeof body.playerId !== "string") return;
      await liveStore().removePlayer(g.id, body.playerId);
      await push(g, "kicked", { playerId: body.playerId });
      return;
    }
  }
  throw new LiveError("Unknown action.");
}

async function endGame(g: LiveGameRow, winner?: string) {
  const s = stateOf(g);
  await push(await bump(g, { status: "ended", ended_at: new Date().toISOString(), state: { ...s, phase: "ended", ...(winner ? { winner } : {}) } }));
}

// ---------- Player actions ----------

type PlayerAction = { action: "answer"; answer: unknown } | { action: "next" } | { action: "pick"; chest: number } | { action: "tap" };

export async function playerAction(code: string, token: unknown, body: PlayerAction): Promise<PlayerView> {
  const store = liveStore();
  const g = await getGame(code);
  let me = await playerFor(g, token);
  const s = stateOf(g);
  const now = Date.now();
  if (g.status !== "playing") throw new LiveError(g.status === "lobby" ? "The game hasn't started yet." : "The game is over.", 409);

  if (g.mode === "classic") {
    if (body.action !== "answer") throw new LiveError("Answer the question on screen.");
    if (s.phase !== "question") throw new LiveError("Too late for this question.", 409);
    if (now > (s.endsAt ?? 0) + GRACE_MS) throw new LiveError("Time's up!", 409);
    const key = String(s.q);
    const d = dataOf(me);
    if (d.answers?.[key]) throw new LiveError("You already answered.", 409);
    const q = questionsOf(g)[s.order![s.q!]];
    const correct = isCorrect(q, body.answer);
    const elapsed = Math.max(0, now - s.startedAt!);
    const speed = 1 - Math.min(1, elapsed / (q.time * 1000)) / 2;
    const streak = correct ? me.streak + 1 : 0;
    const pts = correct && q.points > 0 ? Math.round(1000 * q.points * speed) + Math.min(streak - 1, 5) * 100 : 0;
    me = (await store.updatePlayer(g.id, me.id, {
      score: me.score + pts,
      streak,
      correct: me.correct + (correct ? 1 : 0),
      answered: me.answered + 1,
      data: { ...d, answers: { ...(d.answers ?? {}), [key]: { a: typeof body.answer === "string" ? body.answer.slice(0, 200) : body.answer, correct, pts, at: now } } },
    }))!;
    const all = await store.players(g.id);
    // Everyone's answered: show the answer straight away.
    if (all.every((p) => dataOf(p).answers?.[key])) {
      const fresh = await store.gameByCode(code);
      if (fresh && stateOf(fresh).phase === "question" && stateOf(fresh).q === s.q) {
        const next = await store.updateGame(fresh.id, { state: { ...stateOf(fresh), phase: "reveal" }, version: fresh.version + 1 }, fresh.version);
        if (next) await push(next);
      }
    } else await push(g, "answered", { count: all.filter((p) => dataOf(p).answers?.[key]).length });
    return buildPlayerView((await store.gameByCode(code)) ?? g, me, all);
  }

  // Self-paced modes.
  if (s.phase !== "running") throw new LiveError("The game is over.", 409);
  if (now > (s.endsAt ?? 0)) {
    await endGame(g);
    throw new LiveError("Time's up!", 409);
  }
  const settings = g.settings as GameSettings;
  const qs = questionsOf(g);
  const d = dataOf(me);
  let earned = false;

  if (body.action === "next") {
    if (settings.noSet || d.chests || d.cur) return buildPlayerView(g, me, await store.players(g.id));
    // Avoid repeating the last few questions.
    const recent = d.recent ?? [];
    const pool = qs.map((_, i) => i).filter((i) => !recent.includes(i));
    const qi = (pool.length ? pool : qs.map((_, i) => i))[randomInt(pool.length || qs.length)];
    me = (await store.updatePlayer(g.id, me.id, { data: { ...d, cur: { qi, issuedAt: now }, recent: [...recent, qi].slice(-Math.min(5, Math.max(0, qs.length - 1))) } }))!;
    return buildPlayerView(g, me, await store.players(g.id));
  }

  if (body.action === "answer") {
    if (settings.noSet || !d.cur || d.chests) throw new LiveError("Get a question first.", 409);
    const q = qs[d.cur.qi];
    const correct = isCorrect(q, body.answer);
    const last = { kind: "answer", correct, ...(correct ? {} : { right: q.type === "choice" || q.type === "truefalse" ? (q.correct ?? []).map((i) => q.choices![i]) : q.accepted }) };
    me = (await store.updatePlayer(g.id, me.id, {
      streak: correct ? me.streak + 1 : 0,
      correct: me.correct + (correct ? 1 : 0),
      answered: me.answered + 1,
      data: { ...d, cur: null, last },
    }))!;
    earned = correct;
  } else if (body.action === "tap") {
    if (!settings.noSet) throw new LiveError("Answer questions to play.");
    if (d.chests) throw new LiveError("Pick a chest first.", 409);
    if (now - (d.lastTap ?? 0) < TAP_COOLDOWN_MS[g.mode as "gold" | "rocket"]) throw new LiveError("Too fast!", 429);
    me = (await store.updatePlayer(g.id, me.id, { answered: me.answered + 1, data: { ...d, lastTap: now } }))!;
    earned = true;
  } else if (body.action === "pick" && g.mode === "gold") {
    return pickChest(g, me, body.chest);
  } else throw new LiveError("Unknown action.");

  if (earned) {
    const fresh = dataOf(me);
    if (g.mode === "gold") {
      me = (await store.updatePlayer(g.id, me.id, { data: { ...fresh, chests: makeChests(me.streak) } }))!;
    } else {
      const boost = settings.noSet ? randomInt(2, 8) : 8 + Math.min(me.streak, 4) * 2;
      const score = Math.min(ROCKET_GOAL, me.score + boost);
      me = (await store.updatePlayer(g.id, me.id, {
        score,
        data: { ...fresh, last: { ...(fresh.last ?? {}), kind: fresh.last?.kind ?? "tap", boost } },
        ...(score >= ROCKET_GOAL ? { finished_at: new Date().toISOString() } : {}),
      }))!;
      if (score >= ROCKET_GOAL) {
        const latest = await store.gameByCode(code);
        if (latest && latest.status === "playing") await endGame(latest, me.name);
      }
    }
  }
  return buildPlayerView((await store.gameByCode(code)) ?? g, me, await store.players(g.id));
}

/** Three hidden chests for Gold Rush; what's inside is decided now, so peeking at the network can't help. */
function makeChests(streak: number): Chest[] {
  const base = 10 + Math.min(streak, 10) * 8;
  const roll = (): Chest => {
    const r = randomInt(100);
    if (r < 46) return { kind: "gain", amount: base + randomInt(base) };
    if (r < 58) return { kind: "double", amount: 2 };
    if (r < 71) return { kind: "steal", amount: 10 + randomInt(16) };
    if (r < 75) return { kind: "swap", amount: 0 };
    if (r < 84) return { kind: "lose", amount: 25 };
    return { kind: "nothing", amount: 0 };
  };
  return [roll(), roll(), roll()];
}

async function pickChest(g: LiveGameRow, me: LivePlayerRow, index: unknown): Promise<PlayerView> {
  const store = liveStore();
  const d = dataOf(me);
  if (!d.chests || !Number.isInteger(index) || (index as number) < 0 || (index as number) >= d.chests.length) {
    throw new LiveError("Pick one of the chests.", 409);
  }
  const chest = d.chests[index as number];
  const others = (await store.players(g.id)).filter((p) => p.id !== me.id);
  let gold = me.score;
  let last: Record<string, unknown> = { kind: "chest", chest: chest.kind, all: d.chests.map((c) => c.kind) };
  if (chest.kind === "gain") {
    gold += chest.amount;
    last = { ...last, amount: chest.amount };
  } else if (chest.kind === "double") {
    const add = Math.max(gold, 20);
    gold += add;
    last = { ...last, amount: add };
  } else if (chest.kind === "lose") {
    const lost = Math.floor((gold * chest.amount) / 100);
    gold -= lost;
    last = { ...last, amount: -lost };
  } else if (chest.kind === "steal" || chest.kind === "swap") {
    const targets = chest.kind === "steal" ? others.filter((p) => p.score > 0) : others.filter((p) => p.score > gold);
    if (targets.length === 0) {
      gold += 15;
      last = { ...last, chest: "gain", amount: 15, note: chest.kind === "steal" ? "Nobody had gold to steal" : "Nobody had more gold to swap with" };
    } else {
      const t = targets[randomInt(targets.length)];
      if (chest.kind === "steal") {
        const take = Math.max(1, Math.floor((t.score * chest.amount) / 100));
        await store.updatePlayer(g.id, t.id, { score: Math.max(0, t.score - take), data: { ...dataOf(t), last: { kind: "robbed", by: me.name, amount: take } } });
        gold += take;
        last = { ...last, amount: take, target: t.name };
      } else {
        await store.updatePlayer(g.id, t.id, { score: gold, data: { ...dataOf(t), last: { kind: "swapped", by: me.name } } });
        last = { ...last, amount: t.score - gold, target: t.name };
        gold = t.score;
      }
    }
  }
  me = (await store.updatePlayer(g.id, me.id, { score: Math.max(0, gold), data: { ...d, chests: null, last } }))!;
  return buildPlayerView(g, me, await store.players(g.id));
}

export async function deleteExpiredLiveGames(): Promise<number> {
  return liveStore().deleteExpiredGames(new Date().toISOString());
}

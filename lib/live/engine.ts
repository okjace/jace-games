import "server-only";
import { createHash, randomBytes, randomInt } from "crypto";
import { liveStore, type LiveGameRow, type LivePlayerRow } from "@/lib/db/live";
import { lockerStore } from "@/lib/db/liveLocker";
import { mapStore } from "@/lib/db/liveMaps";
import { studioStore } from "@/lib/db/studio";
import { cleanAvatar, levelInfo, safePicture, xpForGame, type Avatar } from "./locker";
import { DEFAULT_MAP, cleanMap, type TowerMap } from "./maps";
import { broadcast } from "@/lib/realtime/server";
import type { Session } from "@/lib/session";
import {
  HACK_EVERY,
  SHOP,
  TAP_COOLDOWN_MS,
  boosted,
  cast,
  emptyShop,
  hackOptions,
  mine,
  passwordChoices,
  reward,
  scoreCap,
  makePitch,
  newBall,
  easyHit,
  runPlay,
  wrongAnswerStrike,
  type BallState,
  type Pitch,
  type Play,
  shopPrice,
  type Catch,
  type PartyData,
  type ShopItem,
  type ShopLevels,
} from "./party";

/** Modes with the upgrade shop (score is also the currency). */
const SHOP_MODES: LiveMode[] = ["gold", "hack"];
import { DEVICE_MODES, MODES, cleanName, forPlayers, isCorrect, isPlayable, type LiveMode, type PlayerQuestion, type Question } from "./types";

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
const ROCKET_GOAL = 100;

export type GameSettings = { noSet: boolean; minutes: number; shuffle: boolean; /** Tower Siege: a copy of the chosen map, taken when the game is made. */ map?: TowerMap; mapTitle?: string;
  /** Studio-game mode: a copy of the game, taken when the Live game is made. */
  custom?: { gameId: string; title: string; icon: string; owner: string; html: string };
  /** Solo: one player, no host screen. The player moves the game along. */
  solo?: boolean;
  /** Solo: what was picked, so "Play again" can make the same game. */
  setId?: string | null;
  mapId?: string | null;
  gameId?: string | null;
};

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
type PlayerData = PartyData & {
  answers?: Record<string, ClassicAnswer>;
  cur?: { qi: number; issuedAt: number } | null;
  chests?: Chest[] | null;
  lastTap?: number;
  recent?: number[];
  last?: Record<string, unknown> | null;
  /** The icon and frame they show (from their locker, or picked when joining). */
  avatar?: Avatar;
  /** Locker XP this game gave them (set when it ends). */
  xp?: number;
  /** Self-paced modes: every answer, for the review at the end. */
  log?: { qi: number; a: unknown; correct: boolean }[];
};

/** One line of the end-of-game review: the question, what you said, and the right answer. */
export type ReviewItem = { prompt: string; yours: string; right: string; correct: boolean };

const MAX_LOG = 200;

/** An answer as words: the choice's text, or what was typed. */
function answerText(q: Question, a: unknown): string {
  if ((q.type === "choice" || q.type === "truefalse") && typeof a === "number") return q.choices?.[a] ?? "?";
  if (a === null || a === undefined || a === "") return "(no answer)";
  return String(a).slice(0, 120);
}
function rightText(q: Question): string {
  if (q.type === "choice" || q.type === "truefalse") return (q.correct ?? []).map((i) => q.choices?.[i]).filter(Boolean).join(" / ");
  return (q.accepted ?? []).join(" / ");
}

/** Every question this player answered, in order (only once the game is over). */
function reviewFor(g: LiveGameRow, me: LivePlayerRow): ReviewItem[] {
  const qs = questionsOf(g);
  const d = dataOf(me);
  const item = (q: Question | undefined, a: unknown, correct: boolean): ReviewItem | null =>
    q ? { prompt: q.prompt || "(picture question)", yours: answerText(q, a), right: rightText(q), correct } : null;
  if (g.mode === "classic") {
    const order = stateOf(g).order ?? [];
    return order
      .map((qi, i) => {
        const ans = d.answers?.[String(i)];
        return item(qs[qi], ans?.a ?? null, !!ans?.correct);
      })
      .filter((x): x is ReviewItem => !!x)
      .slice(0, (stateOf(g).q ?? order.length - 1) + 1);
  }
  return (d.log ?? []).map((l) => item(qs[l.qi], l.a, l.correct)).filter((x): x is ReviewItem => !!x);
}

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

const avatarOf = (p: LivePlayerRow): Avatar | null => (dataOf(p).avatar as Avatar | undefined) ?? null;

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
  opts: { setId: string | null; mode: LiveMode; settings: Partial<GameSettings> & { mapId?: unknown; gameId?: unknown } },
): Promise<string> {
  const mode = MODES[opts.mode] ? opts.mode : "classic";
  const store = liveStore();
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const solo = opts.settings.solo === true;
  if (!solo && (await store.countGamesByHostSince(session.user.id, since)) >= MAX_GAMES_PER_HOUR) {
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
    ...(solo
      ? {
          solo: true,
          setId: opts.setId,
          mapId: typeof opts.settings.mapId === "string" ? opts.settings.mapId : null,
          gameId: typeof opts.settings.gameId === "string" ? opts.settings.gameId : null,
        }
      : {}),
  };
  // Tower Siege on a custom map: copy it now, so later edits don't change a game in progress.
  if (mode === "tower" && typeof opts.settings.mapId === "string" && opts.settings.mapId) {
    const row = await mapStore().get(opts.settings.mapId);
    const usable = row && (row.owner_id === session.user.id || (row.visibility === "public" && !row.removed));
    const cleaned = usable ? cleanMap(row.data) : null;
    if (!row || !cleaned?.ok) throw new LiveError("That map isn't available.", 404);
    settings.map = cleaned.map;
    settings.mapTitle = row.title;
    await mapStore().addPlay(row.id).catch(() => {});
  }
  if (mode === "custom") {
    const id = typeof opts.settings.gameId === "string" ? opts.settings.gameId : "";
    const row = /^[0-9a-f-]{36}$/i.test(id) ? await studioStore().getGame(id) : null;
    if (!row || row.removed || !row.live_mode) throw new LiveError("That Studio game isn't available as a Live mode.", 404);
    // Your own game plays its latest draft (so you can test it); anyone else's plays what's published.
    const html = row.owner_id === session.user.id ? row.html : row.published ? row.published_html : null;
    if (!html?.trim()) throw new LiveError("That Studio game isn't published yet.", 404);
    settings.custom = { gameId: row.id, title: row.title, icon: row.icon, owner: row.owner_name, html };
    await studioStore().addPlay(row.id).catch(() => {});
  }
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

export async function joinLiveGame(code: string, rawName: unknown, session: Session | null, rawAvatar?: unknown): Promise<{ token: string; playerId: string }> {
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
  // What they show: their locker when signed in, otherwise a starter icon they picked.
  let avatar = cleanAvatar(rawAvatar, 1, null);
  if (session) {
    const locker = await lockerStore().get(session.user.id).catch(() => null);
    if (locker) avatar = cleanAvatar(locker, levelInfo(locker.xp).level, safePicture(session.user.picture));
  }
  await store.updatePlayer(g.id, added.id, { data: { avatar } });
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
  players: { id: string; name: string; score: number; correct: number; answered: number; streak: number; finished: boolean; avatar: Avatar | null }[];
  serverNow: number;
};

/** Settings for the host screen, without the (large) copies of a map or game. */
function hostSettings(st: GameSettings): GameSettings {
  const { map: _map, custom, ...rest } = st;
  void _map;
  return { ...rest, ...(custom ? { custom: { ...custom, html: "" } } : {}) };
}

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
    settings: hostSettings(g.settings as GameSettings),
    state: s,
    topic: topicOf(g),
    questionCount: s.order?.length ?? qs.length,
    current,
    counts,
    answeredCount,
    players: players.map((p) => ({ id: p.id, name: p.name, score: p.score, correct: p.correct, answered: p.answered, streak: p.streak, finished: !!p.finished_at, avatar: avatarOf(p) })),
    serverNow: Date.now(),
  };
}

export type PlayerView = {
  code: string;
  mode: LiveMode;
  status: LiveGameRow["status"];
  noSet: boolean;
  /** Solo games: what was picked, for "Play again". */
  solo: { setId: string | null; minutes: number; shuffle: boolean; mapId: string | null; gameId: string | null } | null;
  phase: string;
  topic: string;
  me: { id: string; name: string; score: number; rank: number; streak: number; correct: number; answered: number; avatar: Avatar | null; xp: number | null };
  playerCount: number;
  top: { name: string; score: number; you: boolean; avatar: Avatar | null }[];
  endsAt: number | null;
  /** Classic: the question being played (no answers), what I answered, and at reveal the right answer. */
  question: (PlayerQuestion & { index: number; total: number }) | null;
  myAnswer: ClassicAnswer | null;
  reveal: { correct?: number[]; accepted?: string[] } | null;
  /** Gold Rush / Rocket Race: my current question, and chests to pick from. */
  selfQuestion: PlayerQuestion | null;
  chests: number | null;
  last: Record<string, unknown> | null;
  /** Once the game is over: each question, what you answered, and the right answer. */
  review: ReviewItem[] | null;
  /** Party modes: what this player may see of their own mode state. */
  party: {
    bank?: number;
    /** Tower Siege: the map being played. */
    map?: TowerMap;
    mapTitle?: string | null;
    /** Studio-game mode: which game (its code comes from customGameHtml). */
    custom?: { title: string; icon: string; owner: string } | null;
    catches?: Catch[];
    /** Fishdex: fish id → heaviest caught. */
    caught?: Record<string, number>;
    frenzy?: number;
    stormed?: boolean;
    password?: string | null;
    passwordChoices?: string[];
    hackReady?: boolean;
    hackCharge?: number;
    hackEvery?: number;
    /** Baseball: the field, and the pitch waiting for a swing (speed only, no outcome). */
    ball?: Omit<BallState, "pitch"> & { pitch: (Pitch & { id: number }) | null };
    /** Gold Rush and Code Breakers: the upgrade shop, with what each next level costs. */
    shop?: { levels: ShopLevels; prices: Record<ShopItem, number | null> };
    hack?: { targetName: string; options: string[] } | null;
    targets?: { id: string; name: string; score: number }[];
  };
  serverNow: number;
};

export async function playerView(code: string, token: unknown): Promise<PlayerView> {
  const g = await getGame(code);
  const me = await playerFor(g, token);
  return buildPlayerView(g, me, await liveStore().players(g.id));
}

/** The Studio game a custom-mode Live game plays, for its players only. */
export async function customGameHtml(code: string, token: unknown): Promise<string> {
  const g = await getGame(code);
  await playerFor(g, token);
  const c = (g.settings as GameSettings).custom;
  if (g.mode !== "custom" || !c) throw new LiveError("This game doesn't use a Studio game.", 404);
  return c.html;
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
    solo: settings.solo
      ? { setId: settings.setId ?? null, minutes: settings.minutes, shuffle: settings.shuffle, mapId: settings.mapId ?? null, gameId: settings.gameId ?? null }
      : null,
    phase: s.phase,
    topic: topicOf(g),
    me: { id: me.id, name: me.name, score: me.score, rank, streak: me.streak, correct: me.correct, answered: me.answered, avatar: avatarOf(me), xp: d.xp ?? null },
    playerCount: all.length,
    top: sorted.slice(0, 5).map((p) => ({ name: p.name, score: p.score, you: p.id === me.id, avatar: avatarOf(p) })),
    endsAt: s.endsAt ?? null,
    question: classicQ ? { ...forPlayers(classicQ), index: s.q!, total: s.order!.length } : null,
    myAnswer: classicQ ? (d.answers?.[String(s.q)] ?? null) : null,
    reveal: classicQ && s.phase === "reveal" ? { correct: classicQ.correct, accepted: classicQ.accepted } : null,
    selfQuestion: g.mode !== "classic" && d.cur && qs[d.cur.qi] && g.status === "playing" ? forPlayers(qs[d.cur.qi]) : null,
    chests: d.chests ? d.chests.length : null,
    last: d.last ?? null,
    review: g.status === "ended" && !settings.noSet ? reviewFor(g, me) : null,
    party: partyView(g, me, all),
    serverNow: Date.now(),
  };
}

function partyView(g: LiveGameRow, me: LivePlayerRow, all: LivePlayerRow[]): PlayerView["party"] {
  const d = dataOf(me);
  if (g.mode === "tower") {
    const settings = g.settings as GameSettings;
    return { bank: d.bank ?? 0, map: settings.map ?? DEFAULT_MAP, mapTitle: settings.mapTitle ?? null };
  }
  if (g.mode === "custom") {
    const c = (g.settings as GameSettings).custom;
    return { bank: d.bank ?? 0, custom: c ? { title: c.title, icon: c.icon, owner: c.owner } : null };
  }
  if (DEVICE_MODES.includes(g.mode)) return { bank: d.bank ?? 0 };
  const levels = d.shop ?? emptyShop();
  const shop = SHOP_MODES.includes(g.mode)
    ? { levels, prices: Object.fromEntries((Object.keys(SHOP) as ShopItem[]).map((k) => [k, shopPrice(k, levels)])) as Record<ShopItem, number | null> }
    : undefined;
  if (g.mode === "gold") return { shop };
  if (g.mode === "baseball") {
    const b = d.ball ?? newBall();
    return { ball: { ...b, strikes: b.strikes ?? 0, pitch: b.pitch ? { id: b.pitch.issuedAt, type: b.pitch.type, ms: b.pitch.ms, curve: b.pitch.curve } : null } };
  }
  if (g.mode === "fishing") return { catches: d.catches ?? [], caught: d.caught ?? {}, frenzy: d.frenzy ?? 0, stormed: !!d.stormed };
  if (g.mode === "hack") {
    return {
      password: d.pw ?? null,
      passwordChoices: d.pw ? undefined : passwordChoices(g.id, me.id),
      hackReady: !!d.hackReady,
      hackCharge: d.hackCharge ?? 0,
      hackEvery: HACK_EVERY,
      // The real answer stays on the server.
      hack: d.hack ? { targetName: d.hack.targetName, options: d.hack.options } : null,
      targets: d.hackReady && !d.hack ? all.filter((p) => p.id !== me.id && dataOf(p).pw).map((p) => ({ id: p.id, name: p.name, score: p.score })) : undefined,
      shop,
    };
  }
  return {};
}

// ---------- Host actions ----------

type HostAction = { action: "start" } | { action: "next" } | { action: "reveal" } | { action: "end" } | { action: "kick"; playerId: string } | { action: "tick" };

export async function hostAction(code: string, session: Session, body: HostAction): Promise<void> {
  const g = await getGame(code);
  if (g.host_id !== session.user.id) throw new LiveError("Only the host can do that.", 403);
  if (body.action === "kick") {
    if (typeof body.playerId !== "string") return;
    await liveStore().removePlayer(g.id, body.playerId);
    await push(g, "kicked", { playerId: body.playerId });
    return;
  }
  await step(g, body.action);
}

/** Moves a game along: from the host's screen, or from the player's in a solo game. */
async function step(g: LiveGameRow, action: string): Promise<void> {
  const s = stateOf(g);
  const now = Date.now();
  const qs = questionsOf(g);
  const settings = g.settings as GameSettings;

  switch (action) {
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
        await endGame(g);
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
  }
  throw new LiveError("Unknown action.");
}

// ---------- Solo ----------

/**
 * A solo game: made, joined and started in one go. Signed-out players get
 * a throwaway host id (they never see a host screen).
 */
export async function startSoloGame(
  session: Session | null,
  opts: { setId: string | null; mode: LiveMode; settings: Record<string, unknown> },
  avatar?: unknown,
): Promise<{ code: string; token: string }> {
  const host: Session = session ?? { token: "", iat: Date.now(), user: { id: `solo:${randomBytes(9).toString("base64url")}`, username: "Solo", picture: null } };
  const code = await createLiveGame(host, { ...opts, settings: { ...opts.settings, solo: true } });
  const { token } = await joinLiveGame(code, session?.user.username ?? "You", session, avatar);
  await step(await getGame(code), "start");
  return { code, token };
}

async function endGame(g: LiveGameRow, winner?: string) {
  const s = stateOf(g);
  const ended = await bump(g, { status: "ended", ended_at: new Date().toISOString(), state: { ...s, phase: "ended", ...(winner ? { winner } : {}) } });
  await giveXp(ended);
  await push(ended);
}

/** Locker XP for everyone signed in, once, when a game ends. */
async function giveXp(g: LiveGameRow) {
  const store = liveStore();
  const players = ranked(await store.players(g.id));
  await Promise.all(
    players.map(async (p, i) => {
      if (!p.user_id || dataOf(p).xp !== undefined) return;
      const xp = xpForGame({ correct: p.correct, answered: p.answered, rank: i + 1, players: players.length });
      await store.updatePlayer(g.id, p.id, { data: { ...dataOf(p), xp } });
      await lockerStore()
        .addXp(p.user_id, xp)
        .catch(() => {});
    }),
  );
}

// ---------- Player actions ----------

type PlayerAction =
  | { action: "answer"; answer: unknown }
  | { action: "next" }
  | { action: "pick"; chest: number }
  | { action: "tap" }
  // Device modes: the score the mini-game reached.
  | { action: "report"; score: number }
  // Solo games: the player moves the game along.
  | { action: "solo"; op: string }
  // Code Breakers.
  | { action: "password"; choice: number }
  | { action: "hack"; target: string }
  | { action: "guess"; choice: number }
  // Gold Rush and Code Breakers.
  | { action: "buy"; item: ShopItem }
  // Baseball: how many ms off perfect the swing was (negative = early), or null to take the pitch.
  | { action: "swing" };

export async function playerAction(code: string, token: unknown, body: PlayerAction): Promise<PlayerView> {
  const store = liveStore();
  const g = await getGame(code);
  let me = await playerFor(g, token);
  if (body.action === "solo") {
    if (!(g.settings as GameSettings).solo) throw new LiveError("Only solo games can do that.", 403);
    if (!["reveal", "next", "tick", "end"].includes(String(body.op))) throw new LiveError("Unknown action.");
    await step(g, String(body.op));
    // Re-read: ending the game may have changed this player (their XP).
    const all = await liveStore().players(g.id);
    return buildPlayerView(await getGame(code), all.find((p) => p.id === me.id) ?? me, all);
  }
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
  let tapped = false;

  // The upgrade shop: pay with your score.
  if (body.action === "buy") {
    if (!SHOP_MODES.includes(g.mode)) throw new LiveError("There's no shop in this mode.");
    const item = (Object.keys(SHOP) as ShopItem[]).find((k) => k === body.item);
    if (!item) throw new LiveError("Pick something from the shop.");
    const levels = d.shop ?? emptyShop();
    const price = shopPrice(item, levels);
    if (price === null) throw new LiveError("That's maxed out!", 409);
    if (me.score < price) throw new LiveError("Not enough to buy that yet.", 409);
    const next: ShopLevels =
      item === "shield" ? { ...levels, shields: levels.shields + 1, shieldsBought: levels.shieldsBought + 1 } : { ...levels, [item]: levels[item] + 1 };
    me = (await store.updatePlayer(g.id, me.id, { score: me.score - price, data: { ...d, shop: next, last: { kind: "bought", item, price } } }))!;
    return buildPlayerView(g, me, await store.players(g.id));
  }

  // Baseball: swing at (or take) the pitch you earned.
  if (body.action === "swing") {
    if (g.mode !== "baseball") throw new LiveError("Unknown action.");
    const ball = d.ball ?? newBall();
    if (!ball.pitch) throw new LiveError("Answer a question to get a pitch.", 409);
    // The HIT button always connects; the server picks how far it goes.
    const play: Play = easyHit(me.streak);
    const { state, runs, inningOver } = runPlay(ball, play);
    const shown: string = play;
    me = (await store.updatePlayer(g.id, me.id, {
      score: me.score + runs,
      data: { ...d, ball: state, last: { kind: "play", play: shown, contact: play, runs, inningOver, inning: state.inning, strikes: state.strikes ?? 0, atBatOver: !state.pitch } },
    }))!;
    return buildPlayerView(g, me, await store.players(g.id));
  }

  // Party-mode actions that aren't about earning.
  if (body.action === "report") {
    if (!DEVICE_MODES.includes(g.mode)) throw new LiveError("Unknown action.");
    const reported = Math.floor(Number(body.score));
    if (!Number.isFinite(reported) || reported < 0) throw new LiveError("Bad score.");
    const cap = scoreCap(g.mode, d.bank ?? 0, (now - (s.startedAt ?? now)) / 1000);
    const score = Math.max(me.score, Math.min(reported, cap));
    if (score !== me.score) me = (await store.updatePlayer(g.id, me.id, { score }))!;
    return buildPlayerView(g, me, await store.players(g.id));
  }
  if (g.mode === "hack") {
    if (body.action === "password") {
      if (d.pw) throw new LiveError("You already picked a password.", 409);
      const choices = passwordChoices(g.id, me.id);
      const pw = choices[Number(body.choice)];
      if (!pw) throw new LiveError("Pick one of the passwords.");
      me = (await store.updatePlayer(g.id, me.id, { data: { ...d, pw } }))!;
      return buildPlayerView(g, me, await store.players(g.id));
    }
    if (!d.pw) throw new LiveError("Pick a password first.", 409);
    if (body.action === "hack") {
      if (!d.hackReady || d.hack) throw new LiveError("You can't hack yet.", 409);
      const target = typeof body.target === "string" ? await store.player(g.id, body.target) : null;
      const tpw = target ? dataOf(target).pw : undefined;
      if (!target || target.id === me.id || !tpw) throw new LiveError("Pick someone to hack.");
      const { options, answer } = hackOptions(tpw);
      me = (await store.updatePlayer(g.id, me.id, { data: { ...d, hackReady: false, hack: { target: target.id, targetName: target.name, options, answer } } }))!;
      return buildPlayerView(g, me, await store.players(g.id));
    }
    if (body.action === "guess") {
      if (!d.hack) throw new LiveError("Start a hack first.", 409);
      const target = await store.player(g.id, d.hack.target);
      const right = Number(body.choice) === d.hack.answer;
      let last: Record<string, unknown> = { kind: "hack", ok: right, target: d.hack.targetName };
      let score = me.score;
      if (target && right) {
        const take = Math.max(1, Math.floor((target.score * (15 + randomInt(11))) / 100));
        await store.updatePlayer(g.id, target.id, { score: Math.max(0, target.score - take), data: { ...dataOf(target), last: { kind: "hacked", by: me.name, amount: take } } });
        score += take;
        last = { ...last, amount: take };
      } else if (target) {
        await store.updatePlayer(g.id, target.id, { data: { ...dataOf(target), last: { kind: "defended", by: me.name } } });
      }
      me = (await store.updatePlayer(g.id, me.id, { score, data: { ...d, hack: null, last } }))!;
      return buildPlayerView(g, me, await store.players(g.id));
    }
  }

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
    const shielded = !correct && me.streak > 0 && (d.shop?.shields ?? 0) > 0;
    const last = { kind: "answer", correct, ...(correct ? {} : { right: q.type === "choice" || q.type === "truefalse" ? (q.correct ?? []).map((i) => q.choices![i]) : q.accepted }) };
    me = (await store.updatePlayer(g.id, me.id, {
      // A shield from the shop saves the streak once.
      streak: correct ? me.streak + 1 : shielded ? me.streak : 0,
      correct: me.correct + (correct ? 1 : 0),
      answered: me.answered + 1,
      data: {
        ...d,
        cur: null,
        last: shielded ? { ...last, shielded: true } : last,
        log: [...(d.log ?? []), { qi: d.cur.qi, a: typeof body.answer === "string" ? body.answer.slice(0, 120) : body.answer, correct }].slice(-MAX_LOG),
        ...(shielded ? { shop: { ...d.shop!, shields: d.shop!.shields - 1 } } : {}),
      },
    }))!;
    earned = correct;
    // Home Run Derby: a wrong answer is a strike; strike three is an out.
    if (!correct && g.mode === "baseball") {
      const fresh = dataOf(me);
      const k = wrongAnswerStrike(fresh.ball ?? newBall());
      const { state, inningOver } = k.out ? runPlay(k.state, "strikeout") : { state: k.state, inningOver: false };
      me = (await store.updatePlayer(g.id, me.id, {
        data: { ...fresh, ball: state, last: { ...(fresh.last ?? {}), play: k.out ? "strikeout" : "strike", strikes: k.state.strikes ?? 0, inningOver, inning: state.inning } },
      }))!;
    }
  } else if (body.action === "tap") {
    if (!settings.noSet) throw new LiveError("Answer questions to play.");
    if (d.chests) throw new LiveError("Pick a chest first.", 409);
    if (now - (d.lastTap ?? 0) < TAP_COOLDOWN_MS[g.mode]) throw new LiveError("Too fast!", 429);
    me = (await store.updatePlayer(g.id, me.id, { answered: me.answered + 1, data: { ...d, lastTap: now } }))!;
    earned = true;
    tapped = true;
  } else if (body.action === "pick" && g.mode === "gold") {
    return pickChest(g, me, body.chest);
  } else throw new LiveError("Unknown action.");

  if (earned && DEVICE_MODES.includes(g.mode)) {
    const fresh = dataOf(me);
    const amount = reward(g.mode, me.streak, tapped);
    me = (await store.updatePlayer(g.id, me.id, {
      data: { ...fresh, bank: (fresh.bank ?? 0) + amount, last: { ...(fresh.last ?? {}), kind: tapped ? "tap" : "answer", correct: true, reward: amount } },
    }))!;
  } else if (earned && g.mode === "fishing") {
    const fresh = dataOf(me);
    const c = cast(me.streak, fresh.frenzy ?? 0, !!fresh.stormed);
    let frenzy = Math.max(0, (fresh.frenzy ?? 0) - (c.kind === "fish" ? 1 : 0));
    if (c.kind === "frenzy") frenzy = 3;
    if (c.kind === "storm") {
      // A storm rolls over everyone else: their next catch is halved.
      const others = (await store.players(g.id)).filter((p) => p.id !== me.id);
      for (const o of others) await store.updatePlayer(g.id, o.id, { data: { ...dataOf(o), stormed: me.name, last: { kind: "stormed", by: me.name } } });
    }
    me = (await store.updatePlayer(g.id, me.id, {
      score: me.score + c.weight,
      data: {
        ...fresh,
        frenzy,
        stormed: c.kind === "fish" ? null : (fresh.stormed ?? null),
        catches: [c, ...(fresh.catches ?? [])].slice(0, 8),
        // The Fishdex keeps your heaviest of each kind.
        caught: c.kind === "fish" ? { ...(fresh.caught ?? {}), [c.id]: Math.max(fresh.caught?.[c.id] ?? 0, c.weight) } : (fresh.caught ?? {}),
        last: {
          kind: "catch",
          catch: c,
          stormedBy: c.kind === "fish" && fresh.stormed ? fresh.stormed : undefined,
          firstCatch: c.kind === "fish" && !fresh.caught?.[c.id],
        },
      },
    }))!;
  } else if (earned && g.mode === "baseball") {
    // A right answer (or a tap) brings a pitch to swing at.
    const fresh = dataOf(me);
    const ball = fresh.ball ?? newBall();
    me = (await store.updatePlayer(g.id, me.id, {
      data: { ...fresh, ball: { ...ball, pitch: { ...makePitch(), issuedAt: now } }, last: { kind: tapped ? "tap" : "answer", correct: true, pitch: true } },
    }))!;
  } else if (earned && g.mode === "hack") {
    const fresh = dataOf(me);
    const bits = boosted(mine(me.streak, tapped), me.streak, fresh.shop);
    const charge = (fresh.hackCharge ?? 0) + 1;
    const ready = !!fresh.hackReady || charge >= HACK_EVERY;
    me = (await store.updatePlayer(g.id, me.id, {
      score: me.score + bits,
      data: { ...fresh, hackCharge: ready ? 0 : charge, hackReady: ready, last: { kind: "bits", amount: bits, correct: true } },
    }))!;
  } else if (earned) {
    const fresh = dataOf(me);
    if (g.mode === "gold") {
      me = (await store.updatePlayer(g.id, me.id, { data: { ...fresh, chests: makeChests(me.streak, fresh.shop) } }))!;
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
function makeChests(streak: number, shop?: ShopLevels): Chest[] {
  // Shop upgrades make every gold chest bigger.
  const base = boosted(10 + Math.min(streak, 10) * 8, streak, shop);
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

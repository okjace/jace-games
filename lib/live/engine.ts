import "server-only";
import { createHash, randomBytes, randomInt } from "crypto";
import { liveStore, type LiveGameRow, type LivePlayerRow } from "@/lib/db/live";
import { grantedOf, lockerStore, lookOf, statsOf } from "@/lib/db/liveLocker";
import { chatStore, type ChatRow } from "@/lib/db/liveChat";
import { mapStore } from "@/lib/db/liveMaps";
import { submitBest, type BoardDetails } from "@/lib/db/liveBoards";
import { cleanTournament, pointsFor, type Tournament } from "./tournament";
import { REPLAY_MAX_BYTES, cleanReplay } from "./replay";
import { EMOTES } from "./emotes";
import { NO_POWERUPS, POWERS, bonusFor, eventOn, nextGap, rollEvent, type PowerEvent } from "./powerups";
import { savePov, saveReplay } from "@/lib/db/liveReplays";

const POV_MAX_FRAMES = 600;
const POV_MAX_BYTES = 1_200_000;
import { TEAMS, cleanTeams, shuffledTeams, smallestTeam, teamIndex, teamScores, type TeamPick, type TeamScore, type TeamSettings } from "./teams";
import { reportStore } from "@/lib/db/liveReports";
import { studioStore } from "@/lib/db/studio";
import { addGameToStats, cleanAvatar, levelInfo, safePicture, xpForGame, type Avatar, type XpPart } from "./locker";
import { GO_BANANAS_MS, bananaBase, boostBananas, rollBanana } from "./banana";
import { CHAT_GAP_MS, cleanChat, type ChatMessage } from "./chat";
import { RARE_ROUNDS, RARE_SECONDS, RARE_TIERS, isRareSet, rareMatch, rarestAnswers } from "./rare";
import { BOSS_HEAL, SUMMIT_STEPS, SURVIVAL_LIVES, bossHit, bossMaxHp, hatch, summitClimb, tugGoal, tugPull, whack, type Team } from "./moreModes";
import { DEFAULT_MAP, cleanMap, type TowerMap } from "./maps";
import { SkillError, earnMoves, kingFinal, kingWrong, skillMove, skillView, type Patch, type SkillOp } from "./skillModes";
import { isSkillMode, type SkillView } from "./skillRules";
import { MpError, mpEarn, mpFlip, mpView, type MpView } from "./memoryParty";
import type { GameReport, ReportAttempt, ReportQuestion } from "./report";
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
import { DEVICE_MODES, MAX_MINUTES, MIN_MINUTES, MODES, cleanName, forPlayers, isCorrect, isPlayable, type LiveMode, type PlayerQuestion, type Question } from "./types";

/**
 * Jace Live, on the server. The host runs the game from a Jace
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
    /** Extra fields for the page (e.g. needsPin when rejoining). */
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

const MAX_PLAYERS = 200;
const GRACE_MS = 1500; // answers can arrive a little after the timer on slow connections
const ROCKET_GOAL = 100;

export type GameSettings = { noSet: boolean; minutes: number; shuffle: boolean; /** Tower Siege: a copy of the chosen map, taken when the game is made. */ map?: TowerMap; mapTitle?: string;
  /** Studio-game mode: a copy of the game, taken when the Live game is made. */
  custom?: { gameId: string; title: string; icon: string; owner: string; html: string };
  /** Chat in the game (on unless the host turns it off). */
  chat?: boolean;
  /** Listed on Discover so anyone can find and join it (never for solo games). */
  public?: boolean;
  /** Solo: one player, no host screen. The player moves the game along. */
  solo?: boolean;
  /** Teams (2–12), and how players get on one. */
  teams?: TeamSettings | null;
  /** A tournament: modes played back to back, with points by place after each round. */
  tournament?: Tournament | null;
  /** The saved replay of the last finished game (its id). */
  replay?: string | null;
  /** Spectators can watch (on unless the host turns it off). */
  spectators?: boolean;
  /** Emote reactions (on unless the host turns them off). */
  emotes?: boolean;
  /** Power-up events (on unless the host turns them off). */
  powerups?: boolean;
  /** Voice calls between Jace Social friends (off unless the host turns them on). */
  calls?: boolean;
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
  /** Power-ups: the event on now (or the last one), and when the next one starts. */
  event?: PowerEvent | null;
  nextEventAt?: number;
  events?: number;
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
  /** Locker XP this game gave them (set when it ends), and what earned it. */
  xp?: number;
  xpParts?: XpPart[];
  /** Rare Finds: how many prompts are done, which they've had, and wrong guesses on this one. */
  rareDone?: number;
  rareSeen?: number[];
  rareGuesses?: string[];
  /** Last One Standing: lives left, and whether they're out. */
  lives?: number;
  out?: boolean;
  /** Boss Battle: how much this player's wrong answers healed the boss. */
  heal?: number;
  /** Dragon Hatchery: best power of each dragon hatched, and the last few hatched. */
  dragons?: Record<string, number>;
  hatched?: { id: string; power: number }[];
  /** Banana Bonanza: GO BANANAS lasts until this time. */
  goUntil?: number;
  /** Guests: the hash of their rejoin PIN. */
  pinHash?: string;
  /** Which team they're on (games with teams). */
  team?: number;
  /** Tournaments: points so far, and what the last round gave. */
  tp?: number;
  tpLast?: number;
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

/** The host's report: every question and exactly what each player chose. */
function buildReport(g: LiveGameRow, players: LivePlayerRow[]): GameReport {
  const qs = questionsOf(g);
  const s = stateOf(g);
  // Classic plays the set in its (maybe shuffled) order; self-paced modes use the set's order.
  const order = g.mode === "classic" ? (s.order ?? qs.map((_, i) => i)) : qs.map((_, i) => i);
  const questions: ReportQuestion[] = order.map((qi) => {
    const q = qs[qi];
    return { prompt: q.prompt || "(picture question)", type: q.type, choices: q.type === "choice" || q.type === "truefalse" ? (q.choices ?? []) : null, right: rightText(q) };
  });
  const posOf = new Map(order.map((qi, i) => [qi, i]));
  return {
    code: g.code,
    mode: g.mode,
    modeName: MODES[g.mode].name,
    setTitle: g.set_title,
    solo: !!(g.settings as GameSettings).solo,
    status: g.status,
    startedAt: g.started_at,
    endedAt: g.ended_at,
    questions,
    players: ranked(players).map((p) => {
      const d = dataOf(p);
      const answers: ReportAttempt[][] = questions.map(() => []);
      if (g.mode === "classic") {
        for (const [key, ans] of Object.entries(d.answers ?? {})) {
          const i = Number(key);
          if (answers[i]) answers[i].push({ yours: answerText(qs[order[i]], ans.a), correct: ans.correct });
        }
      } else {
        for (const l of d.log ?? []) {
          const i = posOf.get(l.qi);
          if (i !== undefined) answers[i].push({ yours: answerText(qs[l.qi], l.a), correct: l.correct });
        }
      }
      return { name: p.name, avatar: avatarOf(p), score: p.score, correct: p.correct, answered: p.answered, answers };
    }),
  };
}

/** The report for the host's own game, while it exists. */
export async function hostReport(code: string, session: Session): Promise<GameReport> {
  const g = await getGame(code);
  if (g.host_id !== session.user.id) throw new LiveError("Only the host can see this.", 403);
  return buildReport(g, await liveStore().players(g.id));
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
  // A tournament starts with its first round's mode.
  const tournament = opts.settings.solo === true ? null : cleanTournament(opts.settings.tournament, !opts.setId);
  const mode = tournament ? tournament.rounds[0] : MODES[opts.mode] ? opts.mode : "classic";
  const store = liveStore();
  const solo = opts.settings.solo === true;
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
  if (mode === "rare" && !isRareSet(questions)) throw new LiveError("Rare Finds only works with a Rare Finds set (one whose answers have rarities).");
  const settings: GameSettings = {
    noSet,
    // 0 = forever (until the host presses End); otherwise 10 seconds to 24 hours, to the second.
    minutes: Number(opts.settings.minutes) === 0 ? 0 : Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round((Number(opts.settings.minutes) || 5) * 60) / 60)),
    shuffle: !!opts.settings.shuffle,
    // Teams (not in solo games, or Tug of War, which has its own two).
    ...(!solo && mode !== "tug" && cleanTeams(opts.settings.teams) ? { teams: cleanTeams(opts.settings.teams) } : {}),
    ...(tournament ? { tournament } : {}),
    ...(opts.settings.powerups === false ? { powerups: false } : {}),
    ...(opts.settings.public === true && opts.settings.solo !== true ? { public: true } : {}),
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

/**
 * Join a game, or rejoin it after leaving by accident: someone signed in
 * gets their old spot back by joining with the same name; a guest needs the
 * 4-digit rejoin PIN they were shown. Rejoining issues a new token, so the
 * old device stops working for that player.
 */
export async function joinLiveGame(
  code: string,
  rawName: unknown,
  session: Session | null,
  rawAvatar?: unknown,
  rawPin?: unknown,
): Promise<{ token: string; playerId: string; pin?: string; rejoined?: boolean }> {
  const g = await getGame(code);
  if (g.status === "ended") throw new LiveError("That game has ended.", 409);
  const name = cleanName(rawName ?? (session?.user.displayName || session?.user.username));
  if (!name) throw new LiveError("Pick a nickname.");
  const store = liveStore();
  const players = await store.players(g.id);
  if (players.length >= MAX_PLAYERS) throw new LiveError("This game is full.", 409);
  const token = randomBytes(24).toString("base64url");
  const added = await store.addPlayer({ game_id: g.id, name, user_id: session?.user.id ?? null, token_hash: sha(token) });
  if (added === "name_taken") {
    const existing = (await store.players(g.id)).find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (!existing) throw new LiveError("Someone already has that name here. Try another.", 409);
    const pinHash = dataOf(existing).pinHash;
    const pinGiven = typeof rawPin === "string" && rawPin.length > 0;
    // Limit PIN tries before checking one, so a PIN can't be guessed.
    if (pinGiven && !existing.user_id && !allowPinTry(g.id, existing.id)) {
      throw new LiveError("Too many PIN tries. Wait a minute, or ask the host.", 429, { needsPin: true });
    }
    const yours =
      (!!session && existing.user_id === session.user.id) ||
      (!existing.user_id && typeof rawPin === "string" && /^\d{4}$/.test(rawPin) && !!pinHash && sha(`${rawPin}:${existing.id}`) === pinHash);
    if (yours) {
      await store.updatePlayer(g.id, existing.id, { token_hash: sha(token) });
      await push(g, "players");
      return { token, playerId: existing.id, rejoined: true };
    }
    if (existing.user_id) throw new LiveError("Someone signed in already has that name here. Pick another.", 409);
    if (pinGiven) {
      throw new LiveError("That PIN isn't right. It's the 4 numbers shown on the screen you joined from.", 403, { needsPin: true });
    }
    throw new LiveError("Someone already has that name here. If it's you, enter your rejoin PIN. Otherwise pick another name.", 409, { needsPin: true });
  }
  // What they show: their locker when signed in, otherwise a starter icon they picked.
  let avatar = cleanAvatar(rawAvatar, 1, null);
  if (session) {
    const locker = await lockerStore().get(session.user.id).catch(() => null);
    void lockerStore()
      .touch(session.user.id, session.user.username)
      .catch(() => {});
    if (locker) avatar = cleanAvatar(lookOf(locker), levelInfo(locker.xp).level, safePicture(session.user.picture), statsOf(locker), grantedOf(locker));
  }
  // Guests get a rejoin PIN (signed-in players rejoin with their Jace account).
  const pin = session ? undefined : String(randomInt(1000, 10000));
  // Random teams: straight onto the smallest team. (Joining mid-game with any team setting does too.)
  const t = (g.settings as GameSettings).teams;
  const team = t && (t.pick === "random" || g.status !== "lobby") ? smallestTeam(t, players.map((p) => dataOf(p).team)) : undefined;
  await store.updatePlayer(g.id, added.id, { data: { avatar, ...(pin ? { pinHash: sha(`${pin}:${added.id}`) } : {}), ...(team !== undefined ? { team } : {}) } });
  await push(g, "players");
  return { token, playerId: added.id, ...(pin ? { pin } : {}) };
}

/** Games hosts listed on Discover that are still going. */
export async function publicLiveGames(): Promise<{ code: string; mode: LiveMode; setTitle: string | null; hostName: string; status: string; players: number }[]> {
  const list = await liveStore().publicGames(24);
  return list.map(({ game, players }) => ({ code: game.code, mode: game.mode, setTitle: game.set_title, hostName: game.host_name, status: game.status, players }));
}

/**
 * Play again: the same game code and everyone still in it, back in the lobby
 * (optionally in a different mode). Scores and mode data reset; each
 * player's look and rejoin PIN are kept, and the game gets 12 more hours.
 */
async function playAgain(g: LiveGameRow, rawMode: string, nextRound = false) {
  if (g.status !== "ended") throw new LiveError("Finish this game first.", 409);
  const mode = (rawMode in MODES ? rawMode : g.mode) as LiveMode;
  let settings = g.settings as GameSettings;
  // The next game gets its own replay.
  if (settings.replay) {
    settings = { ...settings, replay: null };
    g = await bump(g, { settings });
  }
  // A plain "Play again" ends a tournament: no more rounds, points cleared.
  const endTournament = !nextRound && !!settings.tournament;
  if (endTournament) {
    const { tournament: _drop, ...rest } = settings;
    void _drop;
    settings = rest;
    g = await bump(g, { settings });
  }
  if (MODES[mode].needsSet && settings.noSet) throw new LiveError(`${MODES[mode].name} needs a question set.`);
  if (mode === "custom" && !settings.custom) throw new LiveError("Pick a Studio game from Host a game for that mode.");
  const store = liveStore();
  for (const p of await store.players(g.id)) {
    const d = dataOf(p);
    await store.updatePlayer(g.id, p.id, {
      score: 0,
      streak: 0,
      correct: 0,
      answered: 0,
      finished_at: null,
      data: { ...(d.avatar ? { avatar: d.avatar } : {}), ...(d.pinHash ? { pinHash: d.pinHash } : {}), ...(d.team !== undefined ? { team: d.team } : {}), ...(d.tp && !endTournament ? { tp: d.tp, tpLast: d.tpLast } : {}) },
    });
  }
  const now = Date.now();
  await push(
    await bump(g, {
      mode,
      status: "lobby",
      state: { phase: "lobby" },
      started_at: null,
      ended_at: null,
      expires_at: new Date(now + 12 * 3_600_000).toISOString(),
    }),
  );
}

// ---------- Chat ----------

/** Who's chatting: a player (by their key) or the host (signed in). */
async function chatter(g: LiveGameRow, token: unknown, session: Session | null): Promise<{ playerId: string | null; name: string; host: boolean; team: number | null }> {
  if (typeof token === "string" && token.length >= 20) {
    const p = await playerFor(g, token);
    return { playerId: p.id, name: p.name, host: false, team: teamIndex((g.settings as GameSettings).teams, dataOf(p).team) };
  }
  if (session && session.user.id === g.host_id) return { playerId: null, name: session.user.displayName || session.user.username, host: true, team: null };
  throw new LiveError("Join the game to chat.", 401);
}

const chatOut = (m: ChatRow, me: string | null): ChatMessage => ({ id: m.id, name: m.name, host: m.host, text: m.text, at: m.created_at, mine: !!me && m.player_id === me, team: m.team ?? null });

/** The latest chat messages (and whether chat is on). */
export async function chatList(code: string, token: unknown, session: Session | null, after?: string): Promise<{ on: boolean; messages: ChatMessage[] }> {
  const g = await getGame(code);
  const who = await chatter(g, token, session);
  const on = (g.settings as GameSettings).chat !== false;
  const rows = await chatStore().list(g.id, after && /^\d{4}-/.test(after) ? after : undefined);
  // Team messages: only that team sees them (and the host, who keeps an eye on every chat).
  const mine = rows.filter((m) => m.team === null || m.team === undefined || who.host || m.team === who.team);
  return { on, messages: mine.map((m) => chatOut(m, who.playerId)) };
}

const lastChat = new Map<string, number>();

/** Send a chat message: cleaned, rate-limited, and shown to everyone right away. */
export async function chatSend(code: string, token: unknown, session: Session | null, rawText: unknown, toTeam = false): Promise<ChatMessage> {
  const g = await getGame(code);
  const who = await chatter(g, token, session);
  if ((g.settings as GameSettings).chat === false && !who.host) throw new LiveError("The host turned chat off.", 403);
  const text = cleanChat(rawText);
  if (!text) throw new LiveError("Type a message first.");
  const key = `${g.id}:${who.playerId ?? "host"}`;
  const now = Date.now();
  if (now - (lastChat.get(key) ?? 0) < CHAT_GAP_MS) throw new LiveError("Slow down a little!", 429);
  lastChat.set(key, now);
  if (toTeam && who.team === null) throw new LiveError("Ur not on a team yet.", 409);
  const team = toTeam ? who.team : null;
  const row = await chatStore().add({ game_id: g.id, player_id: who.playerId, name: who.name, host: who.host, text, team });
  if (team === null) await broadcast(topicOf(g), "chat", { message: chatOut(row, null) }).catch(() => {});
  else {
    // Only that team's channel, plus the host's.
    await broadcast(teamTopicOf(g, team), "chat", { message: chatOut(row, null) }).catch(() => {});
    await broadcast(teamTopicOf(g, "host"), "chat", { message: chatOut(row, null) }).catch(() => {});
  }
  return chatOut(row, who.playerId);
}

/** The host deletes a message. */
export async function chatDelete(code: string, session: Session, id: string): Promise<void> {
  const g = await getGame(code);
  if (g.host_id !== session.user.id) throw new LiveError("Only the host can delete messages.", 403);
  await chatStore().remove(g.id, id);
  await broadcast(topicOf(g), "chat-deleted", { id }).catch(() => {});
}

/** A signed-in player's unfinished games (any device), for the Rejoin list. */
export async function myActiveGames(session: Session): Promise<{ code: string; mode: LiveMode; status: string; name: string; solo: boolean }[]> {
  const list = await liveStore().activeForUser(session.user.id);
  return list.map(({ game, player }) => ({
    code: game.code,
    mode: game.mode,
    status: game.status,
    name: player.name,
    solo: !!(game.settings as GameSettings).solo,
  }));
}

/** One-tap rejoin for a signed-in player: a fresh key for their spot in this game (the old device stops working). */
export async function rejoinMine(code: string, session: Session): Promise<{ token: string; playerId: string }> {
  const g = await getGame(code);
  if (g.status === "ended") throw new LiveError("That game has ended.", 409);
  const store = liveStore();
  const mine = (await store.players(g.id)).find((p) => p.user_id === session.user.id);
  if (!mine) throw new LiveError("You're not in that game.", 404);
  const token = randomBytes(24).toString("base64url");
  await store.updatePlayer(g.id, mine.id, { token_hash: sha(token) });
  await push(g, "players");
  return { token, playerId: mine.id };
}

/** Rejoin PIN tries: 5 per player per minute (10,000 PINs would take over a day to try). */
const pinTries = new Map<string, number[]>();
function allowPinTry(gameId: string, playerId: string): boolean {
  const key = `${gameId}:${playerId}`;
  const now = Date.now();
  const recent = (pinTries.get(key) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  pinTries.set(key, recent);
  return recent.length <= 5;
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
  players: { id: string; name: string; score: number; correct: number; answered: number; streak: number; finished: boolean; avatar: Avatar | null; team: number | null }[];
  /** Teams: each team's total and place (null without teams), and the channel with every team's chat. */
  teams: TeamScore[] | null;
  teamsTopic: string | null;
  tournament: TournamentView | null;
  replay: string | null;
  /** A power-up event on right now. */
  event: EventView | null;
  /** Memory Party: the shared board for the big screen. */
  mp?: MpView;
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
    players: players.map((p) => ({ id: p.id, name: p.name, score: p.score, correct: p.correct, answered: p.answered, streak: p.streak, finished: !!p.finished_at, avatar: avatarOf(p), team: teamIndex((g.settings as GameSettings).teams, dataOf(p).team) })),
    teams: teamsOf(g, players),
    teamsTopic: (g.settings as GameSettings).teams ? teamTopicOf(g, "host") : null,
    tournament: tournamentOf(g, players),
    replay: (g.settings as GameSettings).replay ?? null,
    event: eventView(g),
    ...(g.mode === "mparty" ? { mp: mpView(g.id, null, players, Date.now()) } : {}),
    serverNow: Date.now(),
  };
}

export type PlayerView = {
  code: string;
  mode: LiveMode;
  status: LiveGameRow["status"];
  noSet: boolean;
  /** Whether chat is on in this game (never in solo games). */
  chatOn: boolean;
  /** Emote reactions are on (never in solo games). */
  emotesOn: boolean;
  /** The host turned voice calls on (never in solo games). */
  callsOn: boolean;
  /** Solo games: what was picked, for "Play again". */
  solo: { setId: string | null; minutes: number; shuffle: boolean; mapId: string | null; gameId: string | null } | null;
  phase: string;
  topic: string;
  me: { id: string; name: string; score: number; rank: number; streak: number; correct: number; answered: number; avatar: Avatar | null; xp: number | null; xpParts: XpPart[] };
  playerCount: number;
  top: { name: string; score: number; you: boolean; avatar: Avatar | null }[];
  /** Teams: how they're picked, my team (null until I'm on one), every team's total, and my team's chat channel. */
  teams: { pick: TeamPick; mine: number | null; scores: TeamScore[]; topic: string | null } | null;
  tournament: TournamentView | null;
  /** The finished game's replay, once saved. */
  replay: string | null;
  /** A power-up event on right now. */
  event: EventView | null;
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
    /** Banana Bonanza: when GO BANANAS ends (0 if it isn't on). */
    goUntil?: number;
    /** Memory Party: the shared board. */
    mp?: MpView;
    /** Territory Wars, Vault Cracker, King of the Hill, Memory Match, Minefield and Sky Stacker. */
    sk?: SkillView;
    /** The skill modes: the summit leader, lives left, the boss's health, or the rope. */
    skill?: {
      goal?: number;
      leader?: { name: string; value: number } | null;
      lives?: number;
      maxLives?: number;
      out?: boolean;
      alive?: number;
      hp?: number;
      maxHp?: number;
      dealt?: number;
      healed?: number;
      team?: Team;
      rope?: number;
      red?: number;
      blue?: number;
    };
    /** Rare Finds: which prompt this is, when its time runs out, and the wrong guesses so far. */
    rare?: { round: number; rounds: number; endsAt: number | null; guesses: string[]; done: boolean };
    /** Dragon Hatchery: best power of each dragon hatched, and the latest hatches. */
    dragons?: Record<string, number>;
    hatched?: { id: string; power: number }[];
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
    chatOn: settings.chat !== false && !settings.solo,
    emotesOn: settings.emotes !== false && !settings.solo,
    callsOn: settings.calls === true && !settings.solo,
    solo: settings.solo
      ? { setId: settings.setId ?? null, minutes: settings.minutes, shuffle: settings.shuffle, mapId: settings.mapId ?? null, gameId: settings.gameId ?? null }
      : null,
    phase: s.phase,
    topic: topicOf(g),
    me: { id: me.id, name: me.name, score: me.score, rank, streak: me.streak, correct: me.correct, answered: me.answered, avatar: avatarOf(me), xp: d.xp ?? null, xpParts: d.xpParts ?? [] },
    playerCount: all.length,
    top: sorted.slice(0, 5).map((p) => ({ name: p.name, score: p.score, you: p.id === me.id, avatar: avatarOf(p) })),
    teams: settings.teams
      ? (() => {
          const mine = teamIndex(settings.teams, d.team);
          return { pick: settings.teams.pick, mine, scores: teamsOf(g, all)!, topic: mine !== null ? teamTopicOf(g, mine) : null };
        })()
      : null,
    tournament: tournamentOf(g, all, me.id),
    replay: g.status === "ended" ? (settings.replay ?? null) : null,
    event: eventView(g),
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

/**
 * When a game's over, a signed-in player can put their score on the global
 * leaderboard for that mode (only their best counts). The score is the one
 * the server kept, never one sent from the browser.
 */
export async function submitToBoard(code: string, token: unknown, session: Session | null): Promise<{ best: boolean; previous: number | null; score: number }> {
  const g = await getGame(code);
  const me = await playerFor(g, token);
  if (g.status !== "ended") throw new LiveError("Finish the game first.", 409);
  if (!session || !me.user_id || me.user_id !== session.user.id) throw new LiveError("Sign in w/ Jace to go on the leaderboards.", 401);
  if (g.mode === "custom") throw new LiveError("Studio games don't have a global leaderboard.");
  // What the game was like, so the leaderboard can show it.
  const all = await liveStore().players(g.id);
  const settings = g.settings as GameSettings;
  const place = [...all].sort((a, b) => b.score - a.score).findIndex((p) => p.id === me.id) + 1;
  const details: BoardDetails = {
    minutes: g.mode === "classic" ? null : Number(settings.minutes ?? 0),
    noSet: !!settings.noSet,
    setTitle: g.set_title ?? null,
    questions: g.questions?.length ?? 0,
    shuffle: !!settings.shuffle,
    players: all.length,
    place: place || 1,
    correct: me.correct,
    answered: me.answered,
    streak: me.streak,
    solo: !!settings.solo,
    host: g.host_name,
    mapTitle: settings.mapTitle ?? null,
    playedSeconds: g.started_at && g.ended_at ? Math.max(0, Math.round((Date.parse(g.ended_at) - Date.parse(g.started_at)) / 1000)) : null,
    playedAt: g.ended_at,
  };
  const res = await submitBest({ user_id: session.user.id, mode: g.mode, best: me.score, username: session.user.displayName || session.user.username, avatar: avatarOf(me), game_code: g.code, details });
  return { ...res, score: me.score };
}

/** Snake Arena: each player's longest snake is their score (it only goes up, and it's capped to stay believable). */
async function saveSnakeScores(g: LiveGameRow, scores: unknown) {
  if (!scores || typeof scores !== "object") return;
  const store = liveStore();
  const all = await store.players(g.id);
  for (const p of all) {
    const v = Math.round(Number((scores as Record<string, unknown>)[p.id]));
    if (Number.isFinite(v) && v > p.score) await store.updatePlayer(g.id, p.id, { score: Math.min(5000, v) });
  }
}

/** Saves skill-mode changes, which can touch other players too (a stolen square, a dethroned king). */
async function applyPatches(g: LiveGameRow, patches: Patch[], all: LivePlayerRow[]): Promise<LivePlayerRow[]> {
  const out: LivePlayerRow[] = [];
  for (const p of patches) {
    const row = all.find((x) => x.id === p.id);
    if (!row) continue;
    const d = dataOf(row);
    const updated = await liveStore().updatePlayer(g.id, p.id, {
      ...(p.score !== undefined ? { score: p.score } : {}),
      data: { ...d, sk: p.sk, last: p.last ?? d.last },
    });
    if (updated) out.push(updated);
  }
  return out;
}

function partyView(g: LiveGameRow, me: LivePlayerRow, all: LivePlayerRow[]): PlayerView["party"] {
  const d = dataOf(me);
  if (isSkillMode(g.mode)) return { sk: skillView(g.mode, me, all, Date.now()) };
  if (g.mode === "mparty") return { mp: mpView(g.id, me, all, Date.now()) };
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
  if (g.mode === "banana") return { goUntil: (d.goUntil ?? 0) > Date.now() ? d.goUntil : 0 };
  if (g.mode === "summit") {
    const best = [...all].sort((a, b) => b.score - a.score)[0];
    return { skill: { goal: SUMMIT_STEPS, leader: best ? { name: best.name, value: best.score } : null } };
  }
  if (g.mode === "survival") {
    return { skill: { lives: d.lives ?? SURVIVAL_LIVES, maxLives: SURVIVAL_LIVES, out: !!d.out, alive: all.filter((p) => !dataOf(p).out).length } };
  }
  if (g.mode === "boss") {
    const t = skillTotals(all);
    const max = bossMaxHp(all.length);
    return { skill: { hp: Math.max(0, max - (t.dealt - t.healed)), maxHp: max, dealt: me.score, healed: d.heal ?? 0 } };
  }
  if (g.mode === "tug") {
    const t = skillTotals(all);
    return { skill: { team: teamOf(me, all), rope: t.red - t.blue, goal: tugGoal(all.length), red: t.red, blue: t.blue } };
  }
  if (g.mode === "hatchery") return { dragons: d.dragons ?? {}, hatched: d.hatched ?? [] };
  if (g.mode === "rare") {
    return {
      rare: {
        round: Math.min(RARE_ROUNDS, (d.rareDone ?? 0) + (d.cur ? 1 : 0)),
        rounds: RARE_ROUNDS,
        endsAt: d.cur ? d.cur.issuedAt + RARE_SECONDS * 1000 : null,
        guesses: d.rareGuesses ?? [],
        done: !!me.finished_at,
      },
    };
  }
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

type HostAction =
  | { action: "start" }
  | { action: "next" }
  | { action: "reveal" }
  | { action: "end" }
  | { action: "kick"; playerId: string }
  | { action: "tick" }
  | { action: "public"; on: boolean }
  | { action: "again"; mode?: string }
  | { action: "chat"; on: boolean }
  | { action: "spectators"; on: boolean }
  | { action: "calls"; on: boolean }
  | { action: "emotes"; on: boolean }
  // Teams: change the setup (lobby only), put someone on a team, or shuffle everyone.
  | { action: "teams"; teams: unknown }
  | { action: "team-set"; playerId: string; team: number }
  | { action: "teams-shuffle" }
  // Tournaments: on to the next round (with everyone's points kept).
  | { action: "next-round" }
  // Snake Arena: the host's screen runs the arena and reports everyone's longest snake.
  | { action: "snake-scores"; scores: Record<string, number> };

export async function hostAction(code: string, session: Session, body: HostAction): Promise<void> {
  const g = await getGame(code);
  if (g.host_id !== session.user.id) throw new LiveError("Only the host can do that.", 403);
  if (body.action === "chat") {
    await push(await bump(g, { settings: { ...(g.settings as GameSettings), chat: body.on === true } }), "chat-settings");
    return;
  }
  if (body.action === "teams") {
    if (g.status !== "lobby") throw new LiveError("Change teams before the game starts.", 409);
    const teams = g.mode === "tug" ? null : cleanTeams(body.teams);
    const next = await bump(g, { settings: { ...(g.settings as GameSettings), teams } });
    // New setup: random teams get dealt out now; otherwise people pick (or get put) again.
    const all = await liveStore().players(g.id);
    if (teams?.pick === "random") await dealTeams(next, all);
    else for (const p of all) if (dataOf(p).team !== undefined && (!teams || dataOf(p).team! >= teams.count)) await liveStore().updatePlayer(g.id, p.id, { data: { ...dataOf(p), team: undefined } });
    await push(next, "players");
    return;
  }
  if (body.action === "team-set") {
    const t = (g.settings as GameSettings).teams;
    const team = teamIndex(t, body.team);
    const p = (await liveStore().players(g.id)).find((x) => x.id === body.playerId);
    if (!p || team === null) throw new LiveError("Pick a team.");
    await liveStore().updatePlayer(g.id, p.id, { data: { ...dataOf(p), team } });
    await push(g, "players");
    return;
  }
  if (body.action === "teams-shuffle") {
    if (!(g.settings as GameSettings).teams) return;
    await dealTeams(g, await liveStore().players(g.id));
    await push(g, "players");
    return;
  }
  if (body.action === "next-round") {
    const t = (g.settings as GameSettings).tournament;
    if (!t || g.status !== "ended") throw new LiveError("Finish this round first.", 409);
    if (t.round + 1 >= t.rounds.length) throw new LiveError("That was the last round!", 409);
    const next = await bump(g, { settings: { ...(g.settings as GameSettings), tournament: { ...t, round: t.round + 1 } } });
    await playAgain(next, t.rounds[t.round + 1], true);
    return;
  }
  if (body.action === "spectators" || body.action === "emotes" || body.action === "calls") {
    await push(await bump(g, { settings: { ...(g.settings as GameSettings), [body.action]: body.on === true } }), "chat-settings");
    return;
  }
  if (body.action === "again") {
    await playAgain(g, typeof body.mode === "string" ? body.mode : g.mode);
    return;
  }
  if (body.action === "snake-scores") {
    if (g.mode !== "snake" || g.status !== "playing") return;
    await saveSnakeScores(g, body.scores);
    return;
  }
  if (body.action === "public") {
    // List the game on Discover (or take it off).
    if (g.status === "ended" || (g.settings as GameSettings).solo) return;
    await push(await bump(g, { settings: { ...(g.settings as GameSettings), public: body.on === true } }));
    return;
  }
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
      const joined = await liveStore().players(g.id);
      if (joined.length === 0) throw new LiveError("Wait for someone to join.");
      await fillTeams(g, joined);
      if (g.mode === "classic") {
        const order = qs.map((_, i) => i);
        if (settings.shuffle) for (let i = order.length - 1; i > 0; i--) { const j = randomInt(i + 1); [order[i], order[j]] = [order[j], order[i]]; }
        const first = qs[order[0]];
        const next = await bump(g, { status: "playing", started_at: new Date(now).toISOString(), state: { phase: "question", q: 0, order, startedAt: now, endsAt: now + first.time * 1000, ...firstEvent(g, now) } });
        await push(next);
      } else {
        const next = await bump(g, { status: "playing", started_at: new Date(now).toISOString(), state: { phase: "running", startedAt: now, ...(settings.minutes ? { endsAt: now + Math.round(settings.minutes * 60) * 1000 } : {}), ...firstEvent(g, now) } });
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
      // The host's screen nudges the server now and then: power-up events, and timers running out.
      if (g.status === "playing") g = await maybeStartEvent(g);
      const st = stateOf(g);
      if (g.mode === "classic" && st.phase === "question" && now >= (st.endsAt ?? 0)) await push(await bump(g, { state: { ...st, phase: "reveal" } }));
      else if (g.mode !== "classic" && st.phase === "running" && st.endsAt && now >= st.endsAt) await endGame(g);
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
): Promise<{ code: string; token: string; pin?: string }> {
  const host: Session = session ?? { token: "", iat: Date.now(), user: { id: `solo:${randomBytes(9).toString("base64url")}`, username: "Solo", picture: null } };
  const code = await createLiveGame(host, { ...opts, settings: { ...opts.settings, solo: true } });
  const { token, pin } = await joinLiveGame(code, session ? session.user.displayName || session.user.username : "You", session, avatar);
  await step(await getGame(code), "start");
  return { code, token, ...(pin ? { pin } : {}) };
}

// ---------- Power-ups ----------

/** The first event's time, when a game starts (if power-ups are on for it). */
function firstEvent(g: LiveGameRow, now: number): Partial<State> {
  const settings = g.settings as GameSettings;
  if (settings.powerups === false || NO_POWERUPS.includes(g.mode)) return {};
  return { nextEventAt: now + nextGap(true), event: null, events: 0 };
}

/** Starts the next power-up event if it's due (and tells everyone). */
async function maybeStartEvent(g: LiveGameRow): Promise<LiveGameRow> {
  const s = stateOf(g);
  const now = Date.now();
  if (!s.nextEventAt || now < s.nextEventAt || eventOn(s.event, now)) return g;
  // Not in the last 20 seconds of a timed game.
  if (s.endsAt && g.mode !== "classic" && s.endsAt - now < 20_000) return g;
  const event = rollEvent((s.events ?? 0) + 1, now, !!(g.settings as GameSettings).solo);
  try {
    const next = await bump(g, { state: { ...s, event, events: event.id, nextEventAt: event.endsAt + nextGap(false) } });
    await push(next, "event");
    return next;
  } catch {
    // Someone else started it at the same moment.
    return (await liveStore().gameByCode(g.code)) ?? g;
  }
}

export type EventView = PowerEvent & { name: string; icon: string; desc: string };
const eventView = (g: LiveGameRow): EventView | null => {
  const e = stateOf(g).event;
  return e && g.status === "playing" && eventOn(e, Date.now()) ? { ...e, ...POWERS[e.kind] } : null;
};

// ---------- Spectators and emotes ----------

export type SpectatorView = {
  code: string;
  mode: LiveMode;
  status: LiveGameRow["status"];
  setTitle: string | null;
  host: string;
  players: { name: string; avatar: Avatar | null; score: number; team: number | null }[];
  teams: TeamScore[] | null;
  tournament: TournamentView | null;
  /** Classic: the question on screen (the answer only once it's revealed). */
  question: { prompt: string; choices: string[] | null; index: number; total: number; right: string | null } | null;
  endsAt: number | null;
  serverNow: number;
  replay: string | null;
  event: EventView | null;
};

/**
 * What a spectator sees: names, scores, teams and the question on screen.
 * No chat and no answers before they're revealed. Spectators don't get the
 * game's live channel (that carries chat), they check back every few seconds.
 */
export async function spectatorView(code: string): Promise<SpectatorView> {
  const g = await getGame(code);
  const settings = g.settings as GameSettings;
  if (settings.solo) throw new LiveError("Solo games can't be watched.", 403);
  if (settings.spectators === false) throw new LiveError("The host turned watching off for this game.", 403);
  const s = stateOf(g);
  const all = ranked(await liveStore().players(g.id));
  const qs = questionsOf(g);
  const cq = g.mode === "classic" && s.order && (s.phase === "question" || s.phase === "reveal") ? qs[s.order[s.q!]] : null;
  return {
    code: g.code,
    mode: g.mode,
    status: g.status,
    setTitle: g.set_title,
    host: g.host_name,
    players: all.slice(0, 50).map((p) => ({ name: p.name, avatar: avatarOf(p), score: p.score, team: teamIndex(settings.teams, dataOf(p).team) })),
    teams: teamsOf(g, all),
    tournament: tournamentOf(g, all),
    question: cq
      ? {
          prompt: cq.prompt || "(picture question)",
          choices: cq.type === "choice" || cq.type === "truefalse" ? (cq.choices ?? []) : null,
          index: s.q!,
          total: s.order!.length,
          right: s.phase === "reveal" ? rightText(cq) : null,
        }
      : null,
    endsAt: s.endsAt ?? null,
    serverNow: Date.now(),
    replay: g.status === "ended" ? (settings.replay ?? null) : null,
    event: eventView(g),
  };
}

const lastEmote = new Map<string, number>();

/** A player's emote: floats up on everyone's screens (no name on it). About one a second each. */
export async function sendEmote(code: string, token: unknown, raw: unknown): Promise<void> {
  const g = await getGame(code);
  const me = await playerFor(g, token);
  if ((g.settings as GameSettings).emotes === false) throw new LiveError("The host turned emotes off.", 403);
  const emoji = EMOTES.find((e) => e === raw);
  if (!emoji) throw new LiveError("Pick an emote.");
  const key = `${g.id}:${me.id}`;
  const now = Date.now();
  if (now - (lastEmote.get(key) ?? 0) < 900) throw new LiveError("Slow down a little!", 429);
  lastEmote.set(key, now);
  if (lastEmote.size > 5000) lastEmote.clear();
  await broadcast(topicOf(g), "emote", { emoji, x: Math.random() });
}

// ---------- Replays ----------

/**
 * Saves a finished game's replay, recorded by the host's screen (or the
 * player's, in a solo game). Once per game; names, looks and teams come from
 * the game itself, not from the recording.
 */
export async function saveGameReplay(code: string, session: Session | null, token: unknown, raw: unknown): Promise<string> {
  const g = await getGame(code);
  const settings = g.settings as GameSettings;
  const isHost = !!session && session.user.id === g.host_id;
  const soloPlayer = settings.solo && typeof token === "string" ? await playerFor(g, token).catch(() => null) : null;
  if (!isHost && !soloPlayer) throw new LiveError("Only the host saves the replay.", 403);
  if (g.status !== "ended") throw new LiveError("Finish the game first.", 409);
  if (settings.replay) return settings.replay;
  const all = await liveStore().players(g.id);
  const data = cleanReplay(raw, {
    code: g.code,
    mode: g.mode,
    setTitle: g.set_title,
    host: settings.solo ? "solo" : g.host_name,
    teams: settings.teams?.count ?? null,
    players: all.map((p) => ({ id: p.id, name: p.name, avatar: avatarOf(p), team: teamIndex(settings.teams, dataOf(p).team) })),
  });
  if (!data || data.frames.length === 0) throw new LiveError("That replay is empty.");
  if (JSON.stringify(data).length > REPLAY_MAX_BYTES) throw new LiveError("That replay is too big to save.", 413);
  const id = await saveReplay({ code: g.code, host_id: g.host_id, mode: g.mode, data });
  const latest = await getGame(code);
  await push(await bump(latest, { settings: { ...(latest.settings as GameSettings), replay: id } }), "replay", { replay: id });
  return id;
}

/** A player sends what their own screen showed during the game (for "watch as" in the replay). */
export async function savePlayerPov(code: string, token: unknown, raw: unknown): Promise<void> {
  const g = await getGame(code);
  const me = await playerFor(g, token);
  const replay = (g.settings as GameSettings).replay;
  if (g.status !== "ended" || !replay) throw new LiveError("The replay isn't saved yet.", 409);
  if (!Array.isArray(raw)) throw new LiveError("Send the frames.");
  const frames = raw
    .slice(0, POV_MAX_FRAMES)
    .filter((f): f is { at: number; v: Record<string, unknown> } => !!f && typeof f === "object" && typeof (f as { at?: unknown }).at === "number" && !!(f as { v?: unknown }).v && typeof (f as { v?: unknown }).v === "object")
    .map((f) => ({ at: Math.round(f.at), v: f.v }));
  if (frames.length === 0) return;
  if (JSON.stringify(frames).length > POV_MAX_BYTES) throw new LiveError("That's too much to save.", 413);
  await savePov(replay, me.id, frames);
}

// ---------- Tournaments ----------

/** End of a tournament round: points by place to every player (and team). Returns the new settings, or null outside tournaments. */
async function scoreRound(g: LiveGameRow): Promise<GameSettings | null> {
  const settings = g.settings as GameSettings;
  const t = settings.tournament;
  if (!t || (t.scored ?? 0) > t.round) return null;
  const all = ranked(await liveStore().players(g.id));
  // Ties share a place.
  let place = 0;
  for (let i = 0; i < all.length; i++) {
    if (i === 0 || all[i].score !== all[i - 1].score) place = i + 1;
    const pts = pointsFor(place);
    const d = dataOf(all[i]);
    await liveStore().updatePlayer(g.id, all[i].id, { data: { ...d, tp: (d.tp ?? 0) + pts, tpLast: pts } });
  }
  const teamPoints = [...(t.teamPoints ?? [])];
  for (const ts of teamsOf(g, all) ?? []) teamPoints[ts.team] = (teamPoints[ts.team] ?? 0) + (ts.players ? pointsFor(ts.rank) : 0);
  return { ...settings, tournament: { ...t, scored: t.round + 1, teamPoints } };
}

export type TournamentView = {
  rounds: LiveMode[];
  round: number;
  /** The last round is over: these are the final standings. */
  done: boolean;
  standings: { name: string; avatar: Avatar | null; tp: number; last: number; you?: boolean; place: number }[];
  teams: { team: number; name: string; icon: string; color: string; tp: number; place: number }[] | null;
};

/** Tournament standings, most points first (null outside tournaments). */
function tournamentOf(g: LiveGameRow, all: LivePlayerRow[], me?: string): TournamentView | null {
  const settings = g.settings as GameSettings;
  const t = settings.tournament;
  if (!t) return null;
  const rows = all.map((p) => ({ id: p.id, name: p.name, avatar: avatarOf(p), tp: dataOf(p).tp ?? 0, last: dataOf(p).tpLast ?? 0 })).sort((a, b) => b.tp - a.tp || a.name.localeCompare(b.name));
  let place = 0;
  const standings = rows.map((r, i) => {
    if (i === 0 || r.tp !== rows[i - 1].tp) place = i + 1;
    return { name: r.name, avatar: r.avatar, tp: r.tp, last: r.last, place, ...(me && r.id === me ? { you: true } : {}) };
  });
  const teams = settings.teams
    ? TEAMS.slice(0, settings.teams.count)
        .map((tm, i) => ({ team: i, name: tm.name, icon: tm.icon, color: tm.color, tp: t.teamPoints?.[i] ?? 0, place: 0 }))
        .sort((a, b) => b.tp - a.tp)
        .map((r, i, arr) => ({ ...r, place: i > 0 && r.tp === arr[i - 1].tp ? 0 : i + 1 }))
    : null;
  // Ties share the place above.
  if (teams) for (let i = 1; i < teams.length; i++) if (!teams[i].place) teams[i].place = teams[i - 1].place;
  return { rounds: t.rounds, round: t.round, done: g.status === "ended" && t.round + 1 >= t.rounds.length, standings, teams };
}

// ---------- Teams ----------

/** Everyone spread evenly over the teams, in a random order. */
async function dealTeams(g: LiveGameRow, all: LivePlayerRow[]) {
  const t = (g.settings as GameSettings).teams;
  if (!t) return;
  const deal = shuffledTeams(t, all.map((p) => p.id));
  for (const p of all) await liveStore().updatePlayer(g.id, p.id, { data: { ...dataOf(p), team: deal.get(p.id) } });
}

/** At the start: anyone still without a team goes on the smallest one. */
async function fillTeams(g: LiveGameRow, all: LivePlayerRow[]) {
  const t = (g.settings as GameSettings).teams;
  if (!t) return;
  const members = all.map((p) => teamIndex(t, dataOf(p).team));
  for (let i = 0; i < all.length; i++) {
    if (members[i] !== null) continue;
    members[i] = smallestTeam(t, members);
    await liveStore().updatePlayer(g.id, all[i].id, { data: { ...dataOf(all[i]), team: members[i]! } });
  }
}

/** Team totals for a game with teams (null without). */
function teamsOf(g: LiveGameRow, all: LivePlayerRow[]): TeamScore[] | null {
  const t = (g.settings as GameSettings).teams;
  return t ? teamScores(t, all.map((p) => ({ team: teamIndex(t, dataOf(p).team), score: p.score }))) : null;
}

/** The realtime channel only one team's players get (team chat). Not guessable from the game's own channel. */
const teamTopicOf = (g: LiveGameRow, team: number | "host") => `jg-live:${sha(`${g.channel}:team:${team}`).slice(0, 24)}`;

async function endGame(g: LiveGameRow, winner?: string) {
  const s = stateOf(g);
  // King of the Hill: count the last king's final stretch on the throne.
  if (g.mode === "king") {
    const all = await liveStore().players(g.id);
    const patch = kingFinal(all, Date.now());
    if (patch) await applyPatches(g, [patch], all);
  }
  const settings = await scoreRound(g);
  const ended = await bump(g, { status: "ended", ended_at: new Date().toISOString(), state: { ...s, phase: "ended", ...(winner ? { winner } : {}) }, ...(settings ? { settings } : {}) });
  await giveXp(ended);
  await saveReport(ended);
  await push(ended);
}

/**
 * Rare Finds, for one player: RARE_ROUNDS random prompts they haven't had,
 * RARE_SECONDS each. Wrong guesses cost nothing; keep guessing until the time
 * runs out. A right answer scores by how rare it is. Time running out (or
 * "skip") moves on with 0 points. After the last prompt they're done.
 */
async function rareAction(g: LiveGameRow, me: LivePlayerRow, body: PlayerAction, now: number): Promise<PlayerView> {
  const store = liveStore();
  const qs = questionsOf(g);
  const d = dataOf(me);
  const done = d.rareDone ?? 0;
  const deadline = (issued: number) => issued + RARE_SECONDS * 1000 + GRACE_MS;
  if (me.finished_at && body.action !== "next") throw new LiveError("You've finished! Wait for the others.", 409);

  if (body.action === "next") {
    if (d.cur || me.finished_at) return buildPlayerView(g, me, await store.players(g.id));
    if (done >= RARE_ROUNDS) return buildPlayerView(g, me, await store.players(g.id));
    // A random prompt they haven't had yet (rare-ready prompts only).
    const seen = new Set(d.rareSeen ?? []);
    const pool = qs.map((q, i) => ({ q, i })).filter(({ q, i }) => q.type === "type" && q.rarity && !seen.has(i));
    const pick = pool.length ? pool[randomInt(pool.length)].i : qs.findIndex((q) => q.type === "type");
    me = (await store.updatePlayer(g.id, me.id, { data: { ...d, cur: { qi: pick, issuedAt: now }, rareSeen: [...seen, pick], rareGuesses: [] } }))!;
    return buildPlayerView(g, me, await store.players(g.id));
  }

  if (body.action !== "answer" && body.action !== "skip") throw new LiveError("Unknown action.");
  if (!d.cur) throw new LiveError("Get a prompt first.", 409);
  const q = qs[d.cur.qi];
  const timeUp = now > deadline(d.cur.issuedAt);
  const typed = typeof (body as { answer?: unknown }).answer === "string" ? String((body as { answer?: unknown }).answer).slice(0, 120) : "";
  const hit = body.action === "answer" && !timeUp && typed.trim() ? rareMatch(q, typed) : null;

  // A wrong guess with time left: try again (nothing lost).
  if (!hit && body.action === "answer" && !timeUp) {
    const guesses = [...(d.rareGuesses ?? []), typed].slice(-8);
    me = (await store.updatePlayer(g.id, me.id, { data: { ...d, rareGuesses: guesses, last: { kind: "rare-miss", guess: typed } } }))!;
    return buildPlayerView(g, me, await store.players(g.id));
  }

  // Right answer, skipped, or out of time: score it and move on.
  const tier = hit?.tier ?? 0;
  const points = hit ? RARE_TIERS[tier].points : 0;
  const finished = done + 1 >= RARE_ROUNDS;
  me = (await store.updatePlayer(g.id, me.id, {
    score: me.score + points,
    streak: hit ? me.streak + 1 : 0,
    correct: me.correct + (hit ? 1 : 0),
    answered: me.answered + 1,
    ...(finished ? { finished_at: new Date(now).toISOString() } : {}),
    data: {
      ...d,
      cur: null,
      rareDone: done + 1,
      rareGuesses: [],
      log: [...(d.log ?? []), { qi: d.cur.qi, a: hit ? hit.answer : typed || "(no answer)", correct: !!hit }].slice(-MAX_LOG),
      last: {
        kind: "rare",
        answer: hit?.answer ?? null,
        tier,
        points,
        // The player's own clock skips at zero, so a skip that late counts as running out of time.
        timeUp: !hit && (timeUp || now >= d.cur.issuedAt + RARE_SECONDS * 1000 - 1000),
        skipped: body.action === "skip" && now < d.cur.issuedAt + RARE_SECONDS * 1000 - 1000,
        prompt: q.prompt,
        examples: rarestAnswers(q, 3),
        round: done + 1,
        finished,
      },
    },
  }))!;
  // Everyone finished: the game is over.
  const all = await store.players(g.id);
  if (finished && all.every((p) => p.finished_at || p.id === me.id)) {
    const latest = await store.gameByCode(g.code);
    if (latest && latest.status === "playing") await endGame(latest);
  }
  return buildPlayerView(g, me, all);
}

/** Tug of War: teams by join order (alternating), so they stay balanced and nothing extra is stored. */
function teamOf(p: LivePlayerRow, all: LivePlayerRow[]): Team {
  const order = [...all].sort((a, b) => a.joined_at.localeCompare(b.joined_at) || a.id.localeCompare(b.id));
  return order.findIndex((x) => x.id === p.id) % 2 === 0 ? "red" : "blue";
}

/** Totals the skill modes need: boss damage and healing, tug team pulls. */
function skillTotals(all: LivePlayerRow[]) {
  let dealt = 0;
  let healed = 0;
  let red = 0;
  let blue = 0;
  for (const p of all) {
    dealt += p.score;
    healed += dataOf(p).heal ?? 0;
    if (teamOf(p, all) === "red") red += p.score;
    else blue += p.score;
  }
  return { dealt, healed, red, blue };
}

/** A wrong answer in the skill modes: slide back, lose a life, or heal the boss. */
async function wrongAnswer(g: LiveGameRow, me: LivePlayerRow): Promise<LivePlayerRow> {
  const store = liveStore();
  const d = dataOf(me);
  if (g.mode === "king") {
    // A wrong answer cracks the king's own shield.
    const all = await store.players(g.id);
    const patch = kingWrong(me, all, Date.now());
    if (patch) return (await applyPatches(g, [patch], all))[0] ?? me;
    return me;
  }
  if (g.mode === "summit") {
    return (await store.updatePlayer(g.id, me.id, { score: Math.max(0, me.score - 1), data: { ...d, last: { ...(d.last ?? {}), slid: me.score > 0 } } }))!;
  }
  if (g.mode === "boss") {
    return (await store.updatePlayer(g.id, me.id, { data: { ...d, heal: (d.heal ?? 0) + BOSS_HEAL, last: { ...(d.last ?? {}), healed: BOSS_HEAL } } }))!;
  }
  if (g.mode === "survival") {
    const lives = (d.lives ?? SURVIVAL_LIVES) - 1;
    const updated = (await store.updatePlayer(g.id, me.id, {
      data: { ...d, lives: Math.max(0, lives), out: lives <= 0, last: { ...(d.last ?? {}), lostLife: true, out: lives <= 0 } },
      ...(lives <= 0 ? { finished_at: new Date().toISOString() } : {}),
    }))!;
    // Everyone out: game over (most right answers wins).
    const all = await store.players(g.id);
    if (all.every((p) => dataOf(p).out)) {
      const latest = await store.gameByCode(g.code);
      if (latest && latest.status === "playing") await endGame(latest);
    }
    return updated;
  }
  return me;
}

/** After a right answer in a skill mode: did someone (or everyone) just win? */
async function checkSkillWin(g: LiveGameRow, me: LivePlayerRow) {
  const store = liveStore();
  const all = await store.players(g.id);
  let winner: string | null = null;
  if (g.mode === "summit" && me.score >= SUMMIT_STEPS) winner = me.name;
  if (g.mode === "boss") {
    const t = skillTotals(all);
    if (t.dealt - t.healed >= bossMaxHp(all.length)) winner = "Everyone";
  }
  if (g.mode === "tug") {
    const t = skillTotals(all);
    if (Math.abs(t.red - t.blue) >= tugGoal(all.length)) winner = t.red > t.blue ? "Red team" : "Blue team";
  }
  if (!winner) return;
  const latest = await store.gameByCode(g.code);
  if (latest && latest.status === "playing") await endGame(latest, winner);
}

/**
 * A copy of the report to see later (games themselves are deleted after 12
 * hours). Solo games save one for the player when they're signed in (their
 * id is the host id); games without questions skip it.
 */
async function saveReport(g: LiveGameRow) {
  const settings = g.settings as GameSettings;
  if (settings.noSet || questionsOf(g).length === 0 || g.host_id.startsWith("solo:")) return;
  const players = await liveStore().players(g.id);
  if (players.length === 0) return;
  await reportStore()
    .save({ host_id: g.host_id, code: g.code, mode: g.mode, set_title: g.set_title, data: buildReport(g, players) })
    .catch(() => {});
}

/** Locker XP for everyone signed in, once, when a game ends. */
async function giveXp(g: LiveGameRow) {
  const store = liveStore();
  const players = ranked(await store.players(g.id));
  await Promise.all(
    players.map(async (p, i) => {
      const d = dataOf(p);
      if (!p.user_id || d.xp !== undefined) return;
      // Best run of right answers, in the order they were given.
      const results =
        g.mode === "classic"
          ? Object.entries(d.answers ?? {})
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([, a]) => a.correct)
          : (d.log ?? []).map((l) => l.correct);
      let run = 0;
      let bestStreak = 0;
      for (const ok of results) {
        run = ok ? run + 1 : 0;
        bestStreak = Math.max(bestStreak, run);
      }
      const daily = await lockerStore()
        .claimDaily(p.user_id)
        .catch(() => false);
      const { total, parts } = xpForGame({ correct: p.correct, answered: p.answered, rank: i + 1, players: players.length, bestStreak, daily });
      await store.updatePlayer(g.id, p.id, { data: { ...d, xp: total, xpParts: parts } });
      await lockerStore()
        .addXp(p.user_id, total)
        .catch(() => {});
      // Stats for badges.
      const won = players.length > 1 && i === 0 && p.score > 0;
      await lockerStore()
        .addStats(p.user_id, (st) => addGameToStats(st, { won, perfect: p.answered >= 5 && p.correct === p.answered, right: p.correct, bestStreak }))
        .catch(() => {});
    }),
  );
}

// ---------- Player actions ----------

type PlayerAction =
  | { action: "answer"; answer: unknown }
  // Teams: pick my team in the lobby.
  | { action: "team"; team: number }
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
  | { action: "swing" }
  // Rare Finds: give up on this prompt.
  | { action: "skip" }
  // The skill modes (see skillModes.ts): a move on your board.
  | ({ action: "skill" } & SkillOp)
  | { action: "snake-score"; score: number }
  // Memory Party: flip a card on the shared board, or just get the latest board.
  | { action: "mparty-flip"; cell: number }
  | { action: "mparty-view" };

/**
 * A player's action, with power-ups on top: a due event starts first, and
 * whatever the action gained (points, or coins in the coin modes) gets the
 * event's bonus.
 */
export async function playerAction(code: string, token: unknown, body: PlayerAction): Promise<PlayerView> {
  let g = await getGame(code);
  if (g.status === "playing") g = await maybeStartEvent(g);
  const s = stateOf(g);
  const now = Date.now();
  const powered = eventOn(s.event, now) && g.status === "playing" && !["report", "team", "solo", "snake-score"].includes(body.action);
  const before = powered ? await playerFor(g, token) : null;
  const view = await playerActionInner(code, token, body);
  if (!powered || !before) return view;
  const store = liveStore();
  const all = await store.players(g.id);
  let me = all.find((p) => p.id === before.id);
  if (!me) return view;
  const coins = DEVICE_MODES.includes(g.mode);
  const gain = coins ? (dataOf(me).bank ?? 0) - (dataOf(before).bank ?? 0) : me.score - before.score;
  const rank = ranked(all).findIndex((p) => p.id === me!.id);
  const { extra, jackpot } = bonusFor(s.event!, gain, rank >= Math.ceil(all.length / 2), coins);
  if (extra <= 0) return view;
  if (jackpot) {
    // Only one player wins the jackpot: whoever claims it first (the game's version decides).
    const latest = await getGame(code);
    const ev = stateOf(latest).event;
    if (!ev || ev.id !== s.event!.id || ev.claimedBy) return view;
    try {
      await push(await bump(latest, { state: { ...stateOf(latest), event: { ...ev, claimedBy: me.name } } }), "event");
    } catch {
      return view;
    }
  }
  const d = dataOf(me);
  me = (await store.updatePlayer(g.id, me.id, coins ? { data: { ...d, bank: (d.bank ?? 0) + extra, last: { ...(d.last ?? {}), power: extra } } } : { score: me.score + extra, data: { ...d, last: { ...(d.last ?? {}), power: extra } } }))!;
  return buildPlayerView(await getGame(code), me, await store.players(g.id));
}

async function playerActionInner(code: string, token: unknown, body: PlayerAction): Promise<PlayerView> {
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
  if (body.action === "team") {
    // Players pick their own team in the lobby (when the host lets them).
    const t = (g.settings as GameSettings).teams;
    if (!t || t.pick !== "players") throw new LiveError("The host picks the teams in this game.", 403);
    if (g.status !== "lobby") throw new LiveError("Teams are locked once the game starts.", 409);
    const team = teamIndex(t, body.team);
    if (team === null) throw new LiveError("Pick a team.");
    me = (await store.updatePlayer(g.id, me.id, { data: { ...dataOf(me), team } }))!;
    await push(g, "players");
    return buildPlayerView(g, me, await store.players(g.id));
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
  if (s.endsAt && now > s.endsAt) {
    await endGame(g);
    throw new LiveError("Time's up!", 409);
  }
  const settings = g.settings as GameSettings;
  const qs = questionsOf(g);
  const d = dataOf(me);
  if (g.mode === "rare") return rareAction(g, me, body, now);
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

  // Memory Party.
  if (body.action === "mparty-view" || body.action === "mparty-flip") {
    if (g.mode !== "mparty") throw new LiveError("Unknown action.");
    if (body.action === "mparty-flip") {
      const all = await store.players(g.id);
      let res: ReturnType<typeof mpFlip>;
      try {
        res = mpFlip(g.id, me, all, (body as { cell?: unknown }).cell, now);
      } catch (e) {
        if (e instanceof MpError) throw new LiveError(e.message, e.status);
        throw e;
      }
      const fresh = dataOf(me);
      me = (await store.updatePlayer(g.id, me.id, { score: me.score + res.points, data: { ...fresh, mp: res.mp, last: res.last } }))!;
      // Everyone's board updates right away.
      await broadcast(topicOf(g), "mp", { by: me.name }).catch(() => {});
    }
    return buildPlayerView(g, me, await store.players(g.id));
  }

  // Snake Arena solo: the player's own device runs the arena and reports their longest snake.
  if (body.action === "snake-score") {
    if (g.mode !== "snake" || !(g.settings as GameSettings).solo) throw new LiveError("Unknown action.");
    await saveSnakeScores(g, { [me.id]: Number((body as { score?: unknown }).score) });
    return buildPlayerView(g, (await store.players(g.id)).find((p) => p.id === me.id) ?? me, await store.players(g.id));
  }

  // The skill modes: spend moves on your board.
  if (body.action === "skill") {
    if (!isSkillMode(g.mode)) throw new LiveError("Unknown action.");
    const all = await store.players(g.id);
    let patches: Patch[];
    try {
      patches = skillMove(g.mode, me, all, body, now);
    } catch (e) {
      if (e instanceof SkillError) throw new LiveError(e.message, e.status);
      throw e;
    }
    me = (await applyPatches(g, patches, all)).find((p) => p.id === me.id) ?? me;
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
    if (g.mode === "survival" && d.out) throw new LiveError("You're out! Watch the others finish.", 409);
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
    if (!correct) me = await wrongAnswer(g, me);
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
  } else if (earned && g.mode === "banana") {
    // Peel a banana event. Some reach other players too.
    const fresh = dataOf(me);
    const going = (fresh.goUntil ?? 0) > now;
    let id = rollBanana();
    const others = (await store.players(g.id)).filter((p) => p.id !== me.id);
    let gain = boostBananas(bananaBase(id, me.score), me.streak, going);
    let target: string | undefined;
    if (id === "monkey") {
      // Your monkey raids a rival with bananas (or, with nobody to raid, finds a bunch).
      const rich = others.filter((o) => o.score > 0);
      const victim = rich[randomInt(rich.length || 1)];
      if (victim) {
        const stolen = Math.min(150, Math.max(1, Math.round(victim.score * 0.15)));
        await store.updatePlayer(g.id, victim.id, { score: victim.score - stolen, data: { ...dataOf(victim), last: { kind: "monkeyed", by: me.name, amount: stolen } } });
        gain = boostBananas(stolen, me.streak, going);
        target = victim.name;
      } else {
        id = "bunch";
        gain = boostBananas(bananaBase("bunch", me.score), me.streak, going);
      }
    } else if (id === "rain") {
      // Bananas for everyone.
      for (const o of others) await store.updatePlayer(g.id, o.id, { score: o.score + 10, data: { ...dataOf(o), last: { kind: "rained", by: me.name, amount: 10 } } });
    } else if (id === "split") {
      // Share with whoever has the fewest.
      const low = [...others].sort((a, b) => a.score - b.score)[0];
      if (low) {
        await store.updatePlayer(g.id, low.id, { score: low.score + 30, data: { ...dataOf(low), last: { kind: "split", by: me.name, amount: 30 } } });
        target = low.name;
      }
    }
    const goUntil = id === "go" ? now + GO_BANANAS_MS : (fresh.goUntil ?? 0);
    me = (await store.updatePlayer(g.id, me.id, {
      score: Math.max(0, me.score + gain),
      data: { ...fresh, goUntil, last: { kind: "banana", event: id, amount: gain, going, goUntil, target } },
    }))!;
  } else if (earned && (g.mode === "summit" || g.mode === "survival" || g.mode === "boss" || g.mode === "tug")) {
    // Skill modes: what a right answer is worth depends only on your streak.
    const fresh = dataOf(me);
    const gain = g.mode === "summit" ? summitClimb(me.streak) : g.mode === "boss" ? bossHit(me.streak) : g.mode === "tug" ? tugPull(me.streak) : 1;
    me = (await store.updatePlayer(g.id, me.id, { score: me.score + gain, data: { ...fresh, last: { kind: g.mode, gain, correct: true } } }))!;
    await checkSkillWin(g, me);
  } else if (earned && g.mode === "hatchery") {
    const fresh = dataOf(me);
    const { dragon, power } = hatch(me.streak);
    const dragons = fresh.dragons ?? {};
    me = (await store.updatePlayer(g.id, me.id, {
      score: me.score + power,
      data: {
        ...fresh,
        dragons: { ...dragons, [dragon.id]: Math.max(dragons[dragon.id] ?? 0, power) },
        hatched: [{ id: dragon.id, power }, ...(fresh.hatched ?? [])].slice(0, 8),
        last: { kind: "hatch", dragon: dragon.id, power, first: !dragons[dragon.id] },
      },
    }))!;
  } else if (earned && g.mode === "pinata") {
    const fresh = dataOf(me);
    const w = whack(me.streak, tapped);
    me = (await store.updatePlayer(g.id, me.id, { score: me.score + w.candy, data: { ...fresh, last: { kind: "whack", whack: w.kind, candy: w.candy } } }))!;
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
  } else if (earned && g.mode === "mparty") {
    // Memory Party: a right answer is a turn (flip two cards).
    const fresh = dataOf(me);
    me = (await store.updatePlayer(g.id, me.id, { data: { ...fresh, mp: mpEarn(me), last: { kind: "mp-turn", correct: true } } }))!;
  } else if (earned && g.mode === "snake") {
    // Snake Arena: a right answer grows your snake (bigger on a streak), wherever the arena is running.
    const fresh = dataOf(me);
    const amount = 10 + Math.min(me.streak, 5) * 3;
    await broadcast(topicOf(g), "snake-feed", { playerId: me.id, amount }).catch(() => {});
    me = (await store.updatePlayer(g.id, me.id, { data: { ...fresh, last: { kind: "feed", amount, correct: true } } }))!;
  } else if (earned && isSkillMode(g.mode)) {
    // The skill modes: a right answer earns moves to play with.
    const fresh = dataOf(me);
    const { sk, gain } = earnMoves(g.mode, me);
    me = (await store.updatePlayer(g.id, me.id, { data: { ...fresh, sk, last: { kind: "moves", gain, correct: true } } }))!;
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
  const now = new Date().toISOString();
  await reportStore()
    .deleteExpired(now)
    .catch(() => 0);
  return liveStore().deleteExpiredGames(now);
}

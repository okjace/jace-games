"use client";

import { useEffect, useRef } from "react";
import type { ReplayEvent, ReplayQuestion, ScoreFrame, SnakeFrame } from "@/lib/live/replay";
import type { Snapshot } from "@/lib/live/snake";
import { TEAMS, type TeamScore } from "@/lib/live/teams";

/**
 * Records a game for its replay while it runs, and saves it when it ends.
 * Lives (hidden) on the host's screen, or on the player's in a solo game.
 */

type Rec = { code: string; start: number; frames: ScoreFrame[]; events: ReplayEvent[]; questions: ReplayQuestion[]; snake: SnakeFrame[]; snakeAt: number; snakeSeen: Set<string>; qSeen: Set<number>; saved: boolean };
let rec: Rec | null = null;

/** Snake Arena's host screen hands each snapshot here (kept ~4 times a second, bodies thinned out). */
export function recordSnake(snap: Snapshot) {
  if (!rec) return;
  const now = Date.now();
  if (now - rec.snakeAt < 250 || rec.snake.length >= 6000) return;
  rec.snakeAt = now;
  const t = now - rec.start;
  rec.snake.push({
    t,
    s: snap.s.map(([id, , color, alive, len, , body]) => {
      const stride = Math.max(1, Math.ceil(body.length / 2 / 30)) * 2;
      const thin: number[] = [];
      for (let i = 0; i + 1 < body.length; i += stride) thin.push(body[i], body[i + 1]);
      return [id, color, alive, len, thin];
    }),
  });
  for (const e of snap.e) {
    if (rec.snakeSeen.has(e)) continue;
    rec.snakeSeen.add(e);
    rec.events.push({ t, text: e });
  }
}

type P = { id: string; name: string; score: number; streak: number; team: number | null };

export function ReplayRecorder({
  code,
  status,
  players,
  teams,
  question,
  token = null,
  saved,
}: {
  code: string;
  status: "lobby" | "playing" | "ended";
  players: P[];
  teams: TeamScore[] | null;
  /** Classic: the question on screen and how the room answered (at reveal). */
  question: { index: number; reveal: boolean; prompt: string; choices: string[] | null; counts: number[] | null; right: string; answered: number } | null;
  /** Solo games: the player's key (they save their own replay). */
  token?: string | null;
  /** The game already has a saved replay. */
  saved: boolean;
}) {
  const latest = useRef({ players, teams, question });
  useEffect(() => {
    latest.current = { players, teams, question };
  });

  // Start a fresh recording when a game starts (a new one each Play again / round).
  useEffect(() => {
    if (status !== "playing") return;
    if (!rec || rec.code !== code || rec.saved) rec = { code, start: Date.now(), frames: [], events: [], questions: [], snake: [], snakeAt: 0, snakeSeen: new Set(), qSeen: new Set(), saved: false };
    const r = rec;
    let leader = "";
    let teamLeader = -1;
    const ranks = new Map<string, number>();
    const streaks = new Map<string, number>();
    const sample = () => {
      const { players: ps, teams: ts } = latest.current;
      const t = Date.now() - r.start;
      const s: Record<string, number> = {};
      for (const p of ps) s[p.id] = p.score;
      // Only keep a frame when something changed (plus one every 10 s).
      const prev = r.frames[r.frames.length - 1];
      const changed = !prev || Object.keys(s).some((k) => prev.s[k] !== s[k]) || t - prev.t >= 10_000;
      if (changed && r.frames.length < 20_000) r.frames.push({ t, s });
      // Big moments, worked out from the scores (the same for every mode).
      const sorted = [...ps].sort((a, b) => b.score - a.score);
      const top = sorted[0];
      if (top && top.score > 0 && top.id !== leader && sorted.length > 1) {
        if (leader) r.events.push({ t, text: `👑 ${top.name} took the lead!` });
        leader = top.id;
      }
      sorted.forEach((p, i) => {
        const before = ranks.get(p.id);
        if (before !== undefined && before - (i + 1) >= 3 && i < 5) r.events.push({ t, text: `🚀 ${p.name} jumped to #${i + 1}` });
        ranks.set(p.id, i + 1);
        const was = streaks.get(p.id) ?? 0;
        for (const mark of [3, 5, 10, 20]) if (was < mark && p.streak >= mark) r.events.push({ t, text: `🔥 ${p.name} is on a ${mark} streak` });
        streaks.set(p.id, p.streak);
      });
      if (ts && ts[0] && ts[0].score > 0 && ts[0].team !== teamLeader) {
        if (teamLeader >= 0) r.events.push({ t, text: `${TEAMS[ts[0].team].icon} the ${ts[0].name} took the lead!` });
        teamLeader = ts[0].team;
      }
      if (r.events.length > 3000) r.events.splice(0, r.events.length - 3000);
    };
    sample();
    const timer = setInterval(sample, 1000);
    return () => clearInterval(timer);
  }, [status, code]);

  // Classic: each question when it's revealed.
  const qKey = question?.reveal ? question.index : -1;
  useEffect(() => {
    const q = latest.current.question;
    if (!rec || qKey < 0 || !q || rec.qSeen.has(qKey)) return;
    rec.qSeen.add(qKey);
    rec.questions.push({ t: Date.now() - rec.start, prompt: q.prompt, choices: q.choices, counts: q.counts, right: q.right, answered: q.answered });
  }, [qKey]);

  // The game ended: one last frame, then save it.
  useEffect(() => {
    if (status !== "ended" || saved || !rec || rec.code !== code || rec.saved || rec.frames.length === 0) return;
    const r = rec;
    r.saved = true;
    const t = Date.now() - r.start;
    const s: Record<string, number> = {};
    for (const p of latest.current.players) s[p.id] = p.score;
    r.frames.push({ t, s });
    r.events.push({ t, text: "🏁 game over!" });
    void fetch(`/api/live/games/${code}/replay`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { "X-Live-Token": token } : {}) },
      body: JSON.stringify({ replay: { startedAt: r.start, length: t, frames: r.frames, events: r.events, questions: r.questions, snake: r.snake } }),
    }).catch(() => {
      r.saved = false;
    });
  }, [status, saved, code, token]);

  return null;
}

/**
 * Records what this player's own screen shows (for "watch as" in the replay)
 * and sends it once the game's replay is saved. Keeps a moment only when the
 * screen changed, at most about twice a second.
 */
// Kept outside the component: the player's screen changes layout when a game ends,
// which remounts this, and the recording must survive that.
const povs = new Map<string, { frames: { at: number; v: Record<string, unknown> }[]; sent: string | null; hadMap: boolean }>();

export function PovRecorder({ code, token, view, skew }: { code: string; token: string; view: import("@/lib/live/engine").PlayerView; skew: number }) {
  useEffect(() => {
    if (view.status !== "playing") return;
    let r = povs.get(code);
    // A new game (Play again / next round): start a fresh recording.
    if (!r || r.sent) {
      r = { frames: [], sent: null, hadMap: false };
      povs.set(code, r);
    }
    const at = Date.now() + skew;
    // Tower Siege's map is big and never changes: keep it in the first moment only.
    const v = JSON.parse(JSON.stringify(view)) as Record<string, unknown> & { party?: Record<string, unknown> };
    if (v.party?.map) {
      if (r.hadMap) delete v.party.map;
      r.hadMap = true;
    }
    const list = r.frames;
    const last = list[list.length - 1];
    // At most about twice a second (the first moment, with the map, always stays).
    if (last && at - last.at < 450 && list.length > 1) list[list.length - 1] = { at, v };
    else list.push({ at, v });
    // Long games: thin out the older moments instead of stopping.
    if (list.length > 600) r.frames = list.filter((_, i) => i === 0 || i % 2 === 0 || i > list.length - 100);
  }, [view, skew, code]);
  useEffect(() => {
    const r = povs.get(code);
    if (view.status !== "ended" || !view.replay || !r || r.sent === view.replay || r.frames.length === 0) return;
    r.sent = view.replay;
    void fetch(`/api/live/games/${code}/replay/pov`, { method: "POST", headers: { "Content-Type": "application/json", "X-Live-Token": token }, body: JSON.stringify({ frames: r.frames }) }).catch(() => {
      r.sent = null;
    });
  }, [view.status, view.replay, code, token]);
  return null;
}

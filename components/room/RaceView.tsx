"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GAME_COMPONENTS } from "@/components/games";
import { RaceContext } from "@/components/games/shared";
import { SEAT_COLORS } from "@/components/multi/types";
import { getGame } from "@/lib/games";
import type { RoomChannel } from "@/lib/realtime/client";
import type { RoomPayload, useRoom } from "./useRoom";

/**
 * A race: every player plays the same seeded game at once. Live scores go
 * straight to the others over the room channel; the final score goes to the
 * server, which checks it and ranks everyone when all are done (or when
 * time runs out).
 */
export function RaceView({
  data,
  channel,
  act,
  onError,
}: {
  data: RoomPayload;
  channel: RoomChannel | null;
  act: ReturnType<typeof useRoom>["act"];
  onError: (e: string | null) => void;
}) {
  const game = getGame(data.room.game)!;
  const Game = GAME_COMPONENTS[game.id];
  const meId = data.me!.userId;
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [left, setLeft] = useState<number | null>(null);
  const sentAt = useRef(0);
  const finished = data.players.find((p) => p.userId === meId)?.finished ?? false;
  const [submitted, setSubmitted] = useState(finished);
  const [timeUp, setTimeUp] = useState(false);
  const progressRef = useRef<number | null>(null);
  const startedRef = useRef(0);
  useEffect(() => {
    startedRef.current = performance.now();
  }, []);

  useEffect(() => {
    if (!channel) return;
    return channel.on("progress", (p) => {
      const { userId, score } = p as { userId: string; score: number };
      setProgress((cur) => ({ ...cur, [userId]: score }));
    });
  }, [channel]);

  // A few updates a second is plenty, but the latest one always goes out.
  const trailing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onProgress = useCallback(
    (score: number) => {
      progressRef.current = score;
      setProgress((cur) => ({ ...cur, [meId]: score }));
      const send = () => {
        sentAt.current = Date.now();
        trailing.current = null;
        channel?.send("progress", { userId: meId, score: progressRef.current });
      };
      const wait = 250 - (Date.now() - sentAt.current);
      if (wait <= 0) send();
      else if (!trailing.current) trailing.current = setTimeout(send, wait);
    },
    [channel, meId],
  );
  useEffect(() => () => void (trailing.current && clearTimeout(trailing.current)), []);

  const onFinish = useCallback(
    async (score: number, durationMs: number) => {
      setSubmitted(true);
      channel?.send("progress", { userId: meId, score });
      const r = await act("result", { score, durationMs });
      onError(r.ok ? null : (r.error ?? null));
    },
    [act, channel, meId, onError],
  );

  const onFail = useCallback(async () => {
    setSubmitted(true);
    const r = await act("result", { dnf: true });
    onError(r.ok ? null : (r.error ?? null));
  }, [act, onError]);

  // Versus races (Block Stacker): garbage goes to one random opponent.
  const opponents = data.players.filter((p) => !p.left && p.userId !== meId).map((p) => p.userId);
  const opponentsKey = opponents.join(",");
  const versus = useMemo(() => {
    if (game.id !== "tetris" || !channel) return undefined;
    const ids = opponentsKey ? opponentsKey.split(",") : [];
    return {
      attack: (lines: number) => {
        if (ids.length) channel.send("attack", { to: ids[Math.floor(Math.random() * ids.length)], lines });
      },
      onAttack: (fn: (lines: number) => void) =>
        channel.on("attack", (p) => {
          const { to, lines } = p as { to: string; lines: number };
          if (to === meId && Number.isInteger(lines) && lines > 0 && lines <= 4) fn(lines);
        }),
    };
  }, [game.id, channel, opponentsKey, meId]);

  // Countdown for timed races. When it runs out, whatever you have counts:
  // your current score where higher is better, otherwise you didn't finish.
  const deadlineIso = data.room.deadline;
  const skew = data.clockSkew;
  const submittedRef = useRef(submitted);
  useEffect(() => {
    submittedRef.current = submitted;
  }, [submitted]);
  useEffect(() => {
    if (!deadlineIso) return;
    const deadline = Date.parse(deadlineIso) - skew;
    let stopped = false;
    let asked = false;
    const t = setInterval(() => {
      // The server allows 3 s of grace after the shown time.
      const ms = deadline - 3000 - Date.now();
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
      if (ms <= 0 && !stopped) {
        stopped = true;
        setTimeUp(true);
        if (!submittedRef.current) {
          submittedRef.current = true;
          setSubmitted(true);
          const score = progressRef.current;
          void (game.better === "higher" && score !== null
            ? act("result", { score, durationMs: performance.now() - startedRef.current })
            : act("result", { dnf: true }));
        }
      }
      if (ms <= -3500 && !asked) {
        asked = true;
        void act("finalize");
      }
    }, 250);
    return () => clearInterval(t);
  }, [deadlineIso, skew, act, game.better]);

  const players = data.players.filter((p) => !p.left);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <section className="relative rounded-2xl border border-line bg-panel/40 p-3 sm:p-6">
        {timeUp && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-background/80 backdrop-blur-sm">
            <p className="text-2xl font-bold">Time&apos;s up!</p>
          </div>
        )}
        <RaceContext.Provider value={true}>
          {Game && (
            <Game
              key={data.room.seed}
              best={null}
              seed={data.room.seed}
              onProgress={onProgress}
              onFinish={submitted ? () => {} : onFinish}
              onFail={submitted ? () => {} : onFail}
              versus={versus}
            />
          )}
        </RaceContext.Provider>
      </section>
      <aside className="flex flex-col gap-3">
        {left !== null && (
          <div className="rounded-2xl border border-line bg-panel p-4 text-center">
            <p className="text-xs text-muted">Time left</p>
            <p className={`text-3xl font-bold tabular-nums ${left <= 10 ? "text-danger" : ""}`}>
              {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
            </p>
          </div>
        )}
        <div className="rounded-2xl border border-line bg-panel p-4">
          <h2 className="mb-3 text-sm font-semibold">Live</h2>
          <ul className="space-y-2">
            {players.map((p) => (
              <li key={p.userId} className="flex items-center gap-2 text-sm">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: SEAT_COLORS[p.seat % SEAT_COLORS.length] }} />
                <span className="min-w-0 flex-1 truncate">
                  {p.username}
                  {p.userId === meId && <span className="text-muted"> (you)</span>}
                </span>
                <span className="font-mono font-semibold tabular-nums">
                  {progress[p.userId] !== undefined ? (game.multiplayer?.progress ?? game.format)(progress[p.userId]) : "—"}
                </span>
                {p.finished && <span title="Finished">✅</span>}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">{game.better === "higher" ? "Highest score wins." : "Lowest score wins."}</p>
        </div>
      </aside>
    </div>
  );
}

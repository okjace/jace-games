"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    if (!channel) return;
    return channel.on("progress", (p) => {
      const { userId, score } = p as { userId: string; score: number };
      setProgress((cur) => ({ ...cur, [userId]: score }));
    });
  }, [channel]);

  const onProgress = useCallback(
    (score: number) => {
      setProgress((cur) => ({ ...cur, [meId]: score }));
      const now = Date.now();
      if (now - sentAt.current < 250) return; // a few updates a second is plenty
      sentAt.current = now;
      channel?.send("progress", { userId: meId, score });
    },
    [channel, meId],
  );

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

  // Countdown for timed races; when time's up, ask the server to wrap up.
  const deadlineIso = data.room.deadline;
  const skew = data.clockSkew;
  useEffect(() => {
    if (!deadlineIso) return;
    const deadline = Date.parse(deadlineIso) - skew;
    let asked = false;
    const t = setInterval(() => {
      const ms = deadline - Date.now();
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
      if (ms <= 0 && !asked) {
        asked = true;
        void act("finalize");
      }
    }, 250);
    return () => clearInterval(t);
  }, [deadlineIso, skew, act]);

  const timeLimitSec = Number(data.room.settings.timeLimitSec) || 0;
  const players = data.players.filter((p) => !p.left);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <section className="rounded-2xl border border-line bg-panel/40 p-3 sm:p-6">
        <RaceContext.Provider value={true}>
          {Game && (
            <Game
              key={data.room.seed}
              best={null}
              seed={data.room.seed}
              onProgress={onProgress}
              onFinish={submitted ? () => {} : onFinish}
              onFail={submitted ? () => {} : onFail}
              timeLimitMs={timeLimitSec ? timeLimitSec * 1000 : undefined}
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
                  {progress[p.userId] !== undefined ? game.format(progress[p.userId]) : "—"}
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

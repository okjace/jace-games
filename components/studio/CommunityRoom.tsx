"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SEAT_COLORS } from "@/components/multi/types";
import type { useRoom, RoomPayload } from "@/components/room/useRoom";
import type { RoomChannel } from "@/lib/realtime/client";
import { GameFrame, type RoomLink } from "./GameFrame";
import { api } from "./ui";

/**
 * A community game ("c:<id>") inside a room. Everyone loads the published
 * game into a sandboxed GameFrame.
 *  - race: everyone plays their own copy (same jace.seed). jace.submitScore
 *    updates your live score; jace.gameOver() sends your last score to the
 *    server as your result (no score = did not finish).
 *  - live: the game shares state itself with jace.room.send/on, relayed
 *    over the room channel; the host's jace.gameOver({ winners }) ends it.
 */
export function CommunityRoomPlay({
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
  const gameId = data.room.game.slice(2);
  const [html, setHtml] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const meId = data.me!.userId;
  const isHost = data.room.host === meId;
  const mode = data.room.mode === "live" ? "live" : "race";

  useEffect(() => {
    api<{ game: { html: string } | null }>(`/api/studio/games/${gameId}`)
      .then((d) => (d.game ? setHtml(d.game.html) : setLoadError("This game isn't published any more.")))
      .catch((e: Error) => setLoadError(e.message));
  }, [gameId]);

  // The players as they were when the round started, so someone leaving doesn't restart the game.
  const currentPlayers = data.players
    .filter((p) => !p.left)
    .map((p) => ({ seat: p.seat, name: p.username, you: p.userId === meId, host: p.userId === data.room.host }));
  const [start, setStart] = useState({ seed: data.room.seed, list: currentPlayers });
  if (start.seed !== data.room.seed) setStart({ seed: data.room.seed, list: currentPlayers });
  const players = start.list;
  const playersKey = JSON.stringify(players);
  const mySeat = data.me!.seat;

  const link = useMemo<RoomLink | null>(() => {
    if (!channel) return null;
    return {
      mode,
      isHost,
      mySeat,
      players: JSON.parse(playersKey),
      send: (event, payload) => channel.send("cg", { from: mySeat, e: event, d: payload }),
      subscribe: (fn) =>
        channel.on("cg", (p) => {
          const m = p as { from?: unknown; e?: unknown; d?: unknown } | null;
          if (!m || !Number.isInteger(m.from) || typeof m.e !== "string" || m.from === mySeat) return;
          fn(m.from as number, m.e, m.d ?? null);
        }),
    };
  }, [channel, mode, isHost, mySeat, playersKey]);

  // Race: live scores to the others, the result to the server.
  const [progress, setProgress] = useState<Record<string, number>>({});
  const latest = useRef<number | null>(null);
  const finished = data.players.find((p) => p.userId === meId)?.finished ?? false;
  const [submitted, setSubmitted] = useState(finished);
  useEffect(() => {
    if (!channel) return;
    return channel.on("progress", (p) => {
      const { userId, score } = p as { userId: string; score: number };
      if (typeof userId === "string" && typeof score === "number") setProgress((cur) => ({ ...cur, [userId]: score }));
    });
  }, [channel]);

  async function finish() {
    if (submitted) return;
    setSubmitted(true);
    const score = latest.current;
    const r = await act("result", score === null ? { dnf: true } : { score });
    onError(r.ok ? null : (r.error ?? null));
  }

  function onScore(score: number) {
    if (mode !== "race" || submitted) return;
    latest.current = score;
    setProgress((cur) => ({ ...cur, [meId]: score }));
    channel?.send("progress", { userId: meId, score });
  }

  async function onGameOver(winners: number[] | null) {
    if (mode === "race") return void finish();
    if (!isHost) return; // only the host's game decides
    const r = await act("end", { winners: winners ?? [] });
    onError(r.ok ? null : (r.error ?? null));
  }

  if (loadError) return <p className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{loadError}</p>;
  if (html === null || !link) return <div className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-foreground/[.04]" aria-busy="true" />;

  const active = data.players.filter((p) => !p.left);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
      <section className="min-w-0 rounded-2xl border border-line bg-panel/40 p-3 sm:p-4">
        <GameFrame
          html={html}
          playerName={data.players.find((p) => p.userId === meId)?.username ?? "Player"}
          seed={data.room.seed}
          room={link}
          title={data.room.gameName}
          onScore={onScore}
          onGameOver={onGameOver}
          autoFocus
        />
        <p className="mt-2 text-xs text-muted">Click the game to use the keyboard. Community games are made by players.</p>
      </section>
      <aside className="flex flex-col gap-3">
        <div className="rounded-2xl border border-line bg-panel p-4">
          <h2 className="mb-3 text-sm font-semibold">{mode === "race" ? "Live scores" : "Players"}</h2>
          <ul className="space-y-2">
            {active.map((p) => (
              <li key={p.userId} className="flex items-center gap-2 text-sm">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: SEAT_COLORS[p.seat % SEAT_COLORS.length] }} />
                <span className="min-w-0 flex-1 truncate">
                  {p.username}
                  {p.userId === meId && <span className="text-muted"> (you)</span>}
                  {p.userId === data.room.host && <span className="text-muted"> · host</span>}
                </span>
                {mode === "race" && <span className="font-mono font-semibold tabular-nums">{progress[p.userId] ?? "—"}</span>}
                {p.finished && <span title="Finished">✅</span>}
              </li>
            ))}
          </ul>
          {mode === "race" ? (
            <>
              <p className="mt-3 text-xs text-muted">Highest score wins. Your result is sent when the game ends.</p>
              {!submitted ? (
                <button
                  type="button"
                  onClick={finish}
                  className="mt-3 inline-flex h-8 items-center rounded-full border border-line px-3 text-xs font-medium hover:bg-foreground/[.05]"
                >
                  I&apos;m done{progress[meId] !== undefined ? ` (${progress[meId]})` : ""}
                </button>
              ) : (
                <p className="mt-3 text-xs font-medium text-accent">Result sent. Waiting for the others…</p>
              )}
            </>
          ) : (
            <p className="mt-3 text-xs text-muted">{isHost ? "You're the host: the game ends when your game says so." : "The host's game decides who wins."}</p>
          )}
        </div>
      </aside>
    </div>
  );
}

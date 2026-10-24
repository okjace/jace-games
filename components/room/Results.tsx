"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { TURN_COMPONENTS } from "@/components/multi";
import { getGame } from "@/lib/games";
import type { RoomPayload, useRoom } from "./useRoom";

const primary =
  "inline-flex h-11 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50";
const secondary =
  "inline-flex h-11 items-center justify-center rounded-full border border-line bg-panel px-5 text-sm font-medium transition-colors hover:bg-foreground/[.05]";

export function Results({
  data,
  act,
  onError,
}: {
  data: RoomPayload;
  act: ReturnType<typeof useRoom>["act"];
  onError: (e: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const game = getGame(data.room.game);
  const placements = [...(data.room.outcome?.placements ?? [])].sort((a, b) => a.placement - b.placement);
  const mine = placements.find((p) => p.userId === data.me?.userId);
  const winners = placements.filter((p) => p.placement === 1 && !p.dnf);
  const draw = data.room.mode !== "race" && placements.every((p) => p.placement === 1);
  const isHost = data.room.host === data.me?.userId;
  const picture = (id: string) => data.players.find((p) => p.userId === id)?.picture ?? null;
  const Board = data.room.mode === "turns" ? TURN_COMPONENTS[data.room.game] : null;

  const headline = draw
    ? "It's a draw!"
    : mine && mine.placement === 1 && !mine.dnf
      ? winners.length > 1
        ? "You tied for first!"
        : "You won! 🎉"
      : winners.length
        ? `${winners.map((w) => w.username).join(" & ")} won`
        : "Game over";

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
        <p className="text-sm text-muted">{data.room.outcome?.reason ?? "Final results"}</p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight">{headline}</h2>
        <ol className="mt-5 space-y-2">
          {placements.map((p) => (
            <li
              key={p.userId}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${p.userId === data.me?.userId ? "bg-accent/10 ring-1 ring-accent/30" : "bg-foreground/[.03]"}`}
            >
              <span className="w-7 text-center text-lg">
                {p.dnf ? "—" : p.placement === 1 ? "🥇" : p.placement === 2 ? "🥈" : p.placement === 3 ? "🥉" : p.placement}
              </span>
              <Avatar name={p.username} src={picture(p.userId)} size={28} />
              <span className="flex-1 truncate font-medium">{p.username}</span>
              <span className="font-mono text-sm font-semibold tabular-nums">
                {p.dnf ? "Didn't finish" : p.score !== undefined && game?.solo !== false && data.room.mode === "race" ? game?.format(p.score) : p.score ?? ""}
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap gap-2">
          {isHost ? (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const r = await act("rematch");
                setBusy(false);
                onError(r.ok ? null : (r.error ?? null));
              }}
              className={primary}
            >
              Rematch
            </button>
          ) : (
            <p className="self-center text-sm text-muted">Waiting for the host to start a rematch…</p>
          )}
          <Link href={game ? `/play/${game.id}` : "/"} className={secondary}>
            Back to {data.room.gameName}
          </Link>
        </div>
      </section>
      {Board && data.view ? (
        <aside className="rounded-2xl border border-line bg-panel/40 p-3">
          <p className="mb-2 px-1 text-xs text-muted">Final board</p>
          <div className="pointer-events-none">
            <Board view={data.view} seat={data.me?.seat ?? null} turn={[]} players={data.players.map((p) => ({ seat: p.seat, name: p.username, you: p.userId === data.me?.userId }))} busy local={false} onMove={() => {}} />
          </div>
        </aside>
      ) : null}
    </div>
  );
}

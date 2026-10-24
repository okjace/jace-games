"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { SEAT_COLORS } from "@/components/multi/types";
import { getGame } from "@/lib/games";
import type { PresenceMember } from "@/lib/realtime/client";
import { FriendInvites } from "./FriendInvites";
import type { RoomPayload, useRoom } from "./useRoom";

const primary =
  "inline-flex h-11 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50";
const secondary =
  "inline-flex h-11 items-center justify-center rounded-full border border-line bg-panel px-5 text-sm font-medium transition-colors hover:bg-foreground/[.05]";

const MODE_TEXT = {
  race: "Everyone plays the same board at the same time. Best result wins.",
  turns: "Take turns. The server referees every move.",
  live: "Real time. Stay connected!",
};

export function Lobby({
  data,
  online,
  act,
  onError,
}: {
  data: RoomPayload;
  online: PresenceMember[];
  act: ReturnType<typeof useRoom>["act"];
  onError: (e: string | null) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const players = data.players.filter((p) => !p.left);
  const meP = players.find((p) => p.userId === data.me?.userId);
  const isHost = data.room.host === data.me?.userId;
  const enough = players.length >= data.room.minPlayers;
  const onlineIds = new Set(online.map((m) => m.key));
  const url = typeof window !== "undefined" ? `${window.location.origin}/r/${data.room.code}` : `/r/${data.room.code}`;
  const game = getGame(data.room.game);

  const run = async (action: string, extra?: Record<string, unknown>) => {
    setBusy(true);
    const r = await act(action, extra);
    setBusy(false);
    onError(r.ok ? null : (r.error ?? null));
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      prompt("Copy this link:", url);
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: `Play ${data.room.gameName} with me`, text: `Join my ${data.room.gameName} game on Jace Games`, url });
    } catch {}
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">
            Players <span className="text-muted">{players.length}/{data.room.maxPlayers}</span>
          </h2>
          <p className="text-xs text-muted">
            {data.room.minPlayers === data.room.maxPlayers ? `${data.room.maxPlayers} players` : `${data.room.minPlayers}–${data.room.maxPlayers} players`}
          </p>
        </div>
        <ul className="space-y-2">
          {Array.from({ length: data.room.maxPlayers }, (_, i) => {
            const p = players.find((x) => x.seat === i) ?? null;
            if (!p) {
              return (
                <li key={i} className="flex h-14 items-center gap-3 rounded-xl border border-dashed border-line px-3 text-sm text-muted">
                  <span className="h-3 w-3 rounded-full opacity-40" style={{ background: SEAT_COLORS[i % SEAT_COLORS.length] }} />
                  Waiting for a player…
                </li>
              );
            }
            const host = data.room.host === p.userId;
            return (
              <li key={p.userId} className="flex h-14 items-center gap-3 rounded-xl bg-foreground/[.03] px-3">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: SEAT_COLORS[p.seat % SEAT_COLORS.length] }} />
                <span className="relative">
                  <Avatar name={p.username} src={p.picture} size={32} />
                  <span
                    title={onlineIds.has(p.userId) ? "Connected" : "Not connected"}
                    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-panel ${onlineIds.has(p.userId) ? "bg-accent" : "bg-muted"}`}
                  />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {p.username}
                  {p.userId === data.me?.userId && <span className="ml-1.5 text-xs font-normal text-muted">(you)</span>}
                  {host && <span className="ml-1.5 text-xs" title="Host">👑</span>}
                </span>
                {host ? (
                  <span className="text-xs text-muted">Host</span>
                ) : p.ready ? (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">Ready</span>
                ) : (
                  <span className="text-xs text-muted">Not ready</span>
                )}
                {isHost && !host && (
                  <button
                    type="button"
                    onClick={() => run("kick", { userId: p.userId })}
                    aria-label={`Remove ${p.username}`}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-foreground/[.08] hover:text-foreground"
                  >
                    ✕
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-sm text-muted">{MODE_TEXT[data.room.mode]}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {isHost ? (
            <button type="button" disabled={!enough || busy} onClick={() => run("start")} className={primary}>
              {enough ? "Start game" : `Need ${data.room.minPlayers - players.length} more`}
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={() => run("ready", { ready: !meP?.ready })} className={meP?.ready ? secondary : primary}>
              {meP?.ready ? "Not ready" : "I'm ready"}
            </button>
          )}
          {!isHost && <p className="self-center text-sm text-muted">The host starts the game.</p>}
        </div>
      </section>

      <aside className="flex flex-col gap-4">
        <div className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="text-sm font-semibold">Invite with a link</h2>
          <p className="mt-3 text-center font-mono text-3xl font-bold tracking-[0.3em]">{data.room.code}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={copy} className={`${secondary} h-10 flex-1`}>
              {copied ? "Copied!" : "Copy link"}
            </button>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button type="button" onClick={share} className={`${secondary} h-10`}>
                Share
              </button>
            )}
          </div>
        </div>
        <FriendInvites code={data.room.code} gameName={data.room.gameName} inRoom={players.map((p) => p.userId)} />
        {game && <p className="px-1 text-xs text-muted">{game.description}</p>}
      </aside>
    </div>
  );
}

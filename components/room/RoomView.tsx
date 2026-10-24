"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Fullscreen } from "@/components/Fullscreen";
import { TURN_COMPONENTS } from "@/components/multi";
import { LIVE_COMPONENTS } from "@/components/multi/live";
import { useScores } from "@/components/ScoresProvider";
import { signInHref } from "@/components/site/SiteHeader";
import { getGame } from "@/lib/games";
import { Lobby } from "./Lobby";
import { RaceView } from "./RaceView";
import { Results } from "./Results";
import { useRoom, type RoomPayload } from "./useRoom";

const card = "rounded-2xl border border-line bg-panel p-6";
const primary =
  "inline-flex h-10 items-center justify-center rounded-full bg-accent px-5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50";
const secondary =
  "inline-flex h-10 items-center justify-center rounded-full border border-line px-5 text-sm font-medium transition-colors hover:bg-foreground/[.05] disabled:opacity-50";

export function RoomView({ code }: { code: string }) {
  const { user } = useScores();
  const me = user ? { userId: user.id, username: user.username } : null;
  const { data, error, gone, channel, online, act } = useRoom(code, me);
  const [notice, setNotice] = useState<string | null>(null);
  const triedJoin = useRef(false);

  // Coming from an invite link: join straight away if there's room.
  useEffect(() => {
    if (!data || !user || data.me || triedJoin.current) return;
    if (data.room.status !== "lobby" || data.players.filter((p) => !p.left).length >= data.room.maxPlayers) return;
    triedJoin.current = true;
    void act("join").then((r) => !r.ok && setNotice(r.error ?? null));
  }, [data, user, act]);

  if (gone) {
    return (
      <div className={`${card} mx-auto max-w-md text-center`}>
        <p className="text-4xl">🚪</p>
        <h1 className="mt-2 text-xl font-bold">This room is gone</h1>
        <p className="mt-1 text-sm text-muted">Everyone left, or it expired after a day.</p>
        <Link href="/" className={`${primary} mt-4`}>
          Back to the games
        </Link>
      </div>
    );
  }
  if (!data) {
    return error ? (
      <div className={`${card} mx-auto max-w-md text-center text-sm text-danger`}>{error}</div>
    ) : (
      <div className="mx-auto h-64 max-w-2xl animate-pulse rounded-2xl bg-foreground/[.04]" aria-busy="true" />
    );
  }

  const game = getGame(data.room.game);
  const icon = game?.icon ?? "🎮";

  if (!user) {
    return (
      <div className={`${card} mx-auto max-w-md text-center`}>
        <p className="text-5xl">{icon}</p>
        <h1 className="mt-2 text-xl font-bold">You&apos;re invited to {data.room.gameName}</h1>
        <p className="mt-1 text-sm text-muted">Sign in with your Jace account to join room {data.room.code}.</p>
        <a href={signInHref(`/r/${data.room.code}`)} className={`${primary} mt-4`}>
          Sign in with Jace
        </a>
      </div>
    );
  }

  const leave = async () => {
    if (data.room.status === "playing" && !confirm("Leave this game? You'll forfeit.")) return;
    await act("leave");
    window.location.href = game ? `/play/${game.id}` : "/";
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="text-3xl">
            {icon}
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{data.room.gameName}</h1>
            <p className="text-sm text-muted">
              Room <span className="font-mono font-semibold tracking-widest text-foreground">{data.room.code}</span> ·{" "}
              {data.room.status === "lobby" ? "Waiting to start" : data.room.status === "playing" ? "Playing" : "Finished"}
            </p>
          </div>
        </div>
        {data.me && (
          <button type="button" onClick={leave} className={secondary}>
            Leave
          </button>
        )}
      </div>

      {notice && (
        <p role="alert" className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {notice}
        </p>
      )}

      {!data.me ? (
        <div className={`${card} text-center`}>
          <p className="font-semibold">
            {data.room.status === "lobby" ? "This room is full." : "This game has already started."}
          </p>
          <Link href={game ? `/play/${game.id}` : "/"} className={`${primary} mt-4`}>
            Start your own
          </Link>
        </div>
      ) : data.room.status === "lobby" ? (
        <Lobby data={data} online={online} act={act} onError={setNotice} />
      ) : data.room.status === "playing" ? (
        <Playing data={data} channel={channel} online={online} act={act} onError={setNotice} />
      ) : (
        <Results data={data} act={act} onError={setNotice} />
      )}
    </div>
  );
}

function Playing({
  data,
  channel,
  online,
  act,
  onError,
}: {
  data: RoomPayload;
  channel: ReturnType<typeof useRoom>["channel"];
  online: ReturnType<typeof useRoom>["online"];
  act: ReturnType<typeof useRoom>["act"];
  onError: (e: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const seat = data.me!.seat;
  const players = data.players
    .filter((p) => !p.left || data.room.mode === "turns")
    .map((p) => ({ seat: p.seat, name: p.username, picture: p.picture, you: p.userId === data.me!.userId, left: p.left }));
  const label = data.room.gameName;

  if (data.room.mode === "turns") {
    const Board = TURN_COMPONENTS[data.room.game];
    if (!Board || !data.view) return <p className="text-sm text-muted">Loading the game…</p>;
    return (
      <Fullscreen label={label}>
        <div className="rounded-2xl border border-line bg-panel/40 p-3 sm:p-6">
          <Board
            view={data.view}
            seat={seat}
            turn={data.turn ?? []}
            players={players}
            busy={busy}
            local={false}
            channel={channel}
            clockSkew={data.clockSkew}
            onMove={async (move) => {
              setBusy(true);
              const r = await act("move", { move, version: data.room.version });
              setBusy(false);
              onError(r.ok ? null : (r.error ?? null));
            }}
          />
        </div>
      </Fullscreen>
    );
  }

  if (data.room.mode === "race") {
    return (
      <Fullscreen label={label} shortcut={!["wordle", "minesweeper"].includes(data.room.game)}>
        <RaceView data={data} channel={channel} act={act} onError={onError} />
      </Fullscreen>
    );
  }

  const Live = LIVE_COMPONENTS[data.room.game];
  if (!Live) return <p className="text-sm text-muted">Loading the game…</p>;
  return (
    <Fullscreen label={label}>
      <div className="rounded-2xl border border-line bg-panel/40 p-3 sm:p-6">
        <Live
          seat={seat}
          seed={data.room.seed}
          isHost={data.room.host === data.me!.userId}
          players={players.filter((p) => !p.left)}
          channel={channel}
          online={online.map((m) => m.key)}
          onEnd={async (winners, scores) => {
            const r = await act("end", { winners, scores });
            onError(r.ok ? null : (r.error ?? null));
          }}
        />
      </div>
    </Fullscreen>
  );
}

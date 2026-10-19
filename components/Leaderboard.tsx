"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { useScores } from "@/components/ScoresProvider";
import { signInHref } from "@/components/site/SiteHeader";
import { compareScores, type GameDef } from "@/lib/games";
import type { LeaderboardRow } from "@/lib/types";

type State =
  | { kind: "loading" }
  | { kind: "ready"; rows: LeaderboardRow[] }
  | { kind: "unavailable" }
  | { kind: "error" };

/**
 * The shared Jace leaderboard for one game (best score per player). Signed
 * out, or until Jace ships its scores API, it falls back to this device's best.
 */
export function Leaderboard({ game, limit = 10, refreshKey = 0 }: { game: GameDef; limit?: number; refreshKey?: number }) {
  const { user, sync, history } = useScores();
  const pathname = usePathname();
  const [state, setState] = useState<State>({ kind: "loading" });

  const userId = user?.id;
  const synced = sync === "synced";
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => (s.kind === "ready" ? s : { kind: "loading" }));
    fetch(`/api/leaderboard?game=${encodeURIComponent(game.id)}&limit=${limit}`, { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json()) as { available?: boolean; scores?: LeaderboardRow[] };
        if (cancelled) return;
        if (!res.ok) setState({ kind: "error" });
        else if (!data.available || !data.scores) setState({ kind: "unavailable" });
        else setState({ kind: "ready", rows: data.scores.slice(0, limit) });
      })
      .catch(() => !cancelled && setState({ kind: "error" }));
    return () => {
      cancelled = true;
    };
    // refreshKey and synced re-fetch after a game ends and after an upload, so a new best shows up.
  }, [userId, game.id, limit, refreshKey, synced]);

  const deviceTop = history
    .filter((s) => s.game === game.id)
    .sort(compareScores(game))
    .slice(0, limit);

  if (!user || state.kind === "unavailable" || state.kind === "error") {
    return (
      <div>
        <p className="mb-3 text-sm text-muted">
          {!user ? (
            <>
              <a href={signInHref(pathname)} className="font-medium text-accent hover:underline">
                Sign in with Jace
              </a>{" "}
              to see the leaderboard everyone on Jace shares.
            </>
          ) : state.kind === "unavailable" ? (
            "Sync with Jace is coming soon — until then, here are your best scores."
          ) : (
            "Couldn't load the leaderboard. Here are your best scores on this device."
          )}
        </p>
        {deviceTop.length > 0 && (
          <ol className="space-y-1">
            {deviceTop.map((s, i) => (
              <Row key={s.id} rank={i + 1} name={user?.username ?? "You"} picture={user?.picture} score={game.format(s.score)} you />
            ))}
          </ol>
        )}
      </div>
    );
  }

  if (state.kind === "loading") {
    return (
      <ol className="space-y-1" aria-busy="true">
        {Array.from({ length: Math.min(limit, 5) }, (_, i) => (
          <li key={i} className="h-10 animate-pulse rounded-xl bg-foreground/[.04]" />
        ))}
      </ol>
    );
  }

  if (state.rows.length === 0) {
    return <p className="text-sm text-muted">No scores yet. Be the first!</p>;
  }

  return (
    <ol className="space-y-1">
      {state.rows.map((r, i) => (
        <Row
          key={r.user_id}
          rank={i + 1}
          name={r.username}
          picture={r.picture}
          score={game.format(r.score)}
          you={r.user_id === user.id}
        />
      ))}
    </ol>
  );
}

function Row({
  rank,
  name,
  picture,
  score,
  you,
}: {
  rank: number;
  name: string;
  picture?: string | null;
  score: string;
  you?: boolean;
}) {
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  return (
    <li
      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${
        you ? "bg-accent/10 ring-1 ring-accent/30" : "odd:bg-foreground/[.03]"
      }`}
    >
      <span className="w-6 shrink-0 text-center font-mono text-muted">{medal ?? rank}</span>
      <Avatar name={name} src={picture} size={24} />
      <span className="min-w-0 flex-1 truncate font-medium">
        {name}
        {you && <span className="ml-1.5 text-xs font-normal text-muted">(you)</span>}
      </span>
      <span className={`shrink-0 font-mono font-semibold tabular-nums ${rank === 1 ? "text-accent" : ""}`}>{score}</span>
    </li>
  );
}

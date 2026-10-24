"use client";

import { useEffect, useState } from "react";
import { useScores } from "@/components/ScoresProvider";

/** Most multiplayer wins for a game (from match results kept by Jace Games). */
export function WinsBoard({ gameId, limit = 10 }: { gameId: string; limit?: number }) {
  const { user } = useScores();
  const [rows, setRows] = useState<{ user_id: string; username: string; wins: number; played: number }[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/wins?game=${encodeURIComponent(gameId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => !cancelled && setRows(d.rows ?? []))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  if (failed) return <p className="text-sm text-muted">Couldn&apos;t load wins.</p>;
  if (!rows) return <div className="h-20 animate-pulse rounded-xl bg-foreground/[.04]" />;
  if (rows.length === 0) return <p className="text-sm text-muted">No wins yet. Start a game with a friend!</p>;
  return (
    <ol className="space-y-1">
      {rows.slice(0, limit).map((r, i) => (
        <li
          key={r.user_id}
          className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${r.user_id === user?.id ? "bg-accent/10 ring-1 ring-accent/30" : "odd:bg-foreground/[.03]"}`}
        >
          <span className="w-6 text-center font-mono text-muted">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
          <span className="min-w-0 flex-1 truncate font-medium">{r.username}</span>
          <span className="font-mono font-semibold tabular-nums">
            {r.wins} <span className="font-normal text-muted">/ {r.played}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

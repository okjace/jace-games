"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MULTIPLAYER_GAMES } from "@/lib/games";

/** The signed-in player's multiplayer wins per game. */
export function MultiplayerRecord() {
  const [records, setRecords] = useState<{ game: string; wins: number; played: number }[] | null>(null);
  useEffect(() => {
    fetch("/api/wins?me=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { records: [] }))
      .then((d) => setRecords(d.records ?? []))
      .catch(() => setRecords([]));
  }, []);
  const by = new Map((records ?? []).map((r) => [r.game, r]));
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Multiplayer</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {MULTIPLAYER_GAMES.map((g) => {
          const r = by.get(g.id);
          return (
            <li key={g.id}>
              <Link href={`/play/${g.id}`} className="flex items-center gap-4 rounded-2xl border border-line bg-panel p-4 transition-colors hover:border-accent/50">
                <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-xl bg-foreground/[.05] text-2xl">
                  {g.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{g.name}</p>
                  <p className="text-xs text-muted">{r ? `${r.played} game${r.played === 1 ? "" : "s"} played` : "Not played with friends yet"}</p>
                </div>
                <span className={`font-semibold tabular-nums ${r?.wins ? "text-accent" : "text-muted"}`}>
                  {records === null ? "…" : `${r?.wins ?? 0} win${r?.wins === 1 ? "" : "s"}`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { SetSummary } from "@/lib/live/types";
import { SetGrid } from "./LiveHome";
import Link from "next/link";
import { MODES, type LiveMode } from "@/lib/live/types";
import { card, input, primary, secondary } from "./ui";

const TAGS = ["science", "math", "history", "geography", "english", "music", "movies", "games", "sports", "trivia", "minecraft", "fun"];

/** Public sets from everyone on Jace: search, filter by tag, popular or new. */
export function Discover() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState<"popular" | "new">("popular");
  const [page, setPage] = useState(0);
  const [sets, setSets] = useState<SetSummary[] | null>(null);
  const [more, setMore] = useState(false);

  // Search a moment after typing stops.
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    const sp = new URLSearchParams({ sort, page: String(page) });
    if (query) sp.set("q", query);
    if (tag) sp.set("tag", tag);
    fetch(`/api/live/discover?${sp}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const list: SetSummary[] = d.sets ?? [];
        setSets((cur) => (page === 0 ? list : [...(cur ?? []), ...list]));
        setMore(list.length === 24);
      })
      .catch(() => !cancelled && setSets((cur) => cur ?? []));
    return () => {
      cancelled = true;
    };
  }, [query, tag, sort, page]);

  const reset = (fn: () => void) => {
    fn();
    setPage(0);
    setSets(null);
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Discover</h1>
        <p className="mt-1 text-muted">Question sets made by people on Jace. Pick one and host it, or jump into a game that&apos;s on right now.</p>
      </div>
      <OpenGames />
      <div className="flex flex-col gap-3 sm:flex-row">
        <input value={q} onChange={(e) => reset(() => setQ(e.target.value))} placeholder="Search sets" aria-label="Search sets" className={input} />
        <div className="inline-flex shrink-0 rounded-full border border-line p-1 text-sm" role="group" aria-label="Sort">
          {(["popular", "new"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sort === s}
              onClick={() => reset(() => setSort(s))}
              className={`rounded-full px-4 py-1.5 font-medium capitalize ${sort === s ? "bg-foreground/[.08]" : "text-muted hover:text-foreground"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {TAGS.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tag === t}
            onClick={() => reset(() => setTag(tag === t ? null : t))}
            className={`rounded-full border px-3 py-1 text-sm ${tag === t ? "border-accent bg-accent text-on-accent" : "border-line bg-panel text-muted hover:text-foreground"}`}
          >
            #{t}
          </button>
        ))}
      </div>
      {sets === null ? (
        <div className="h-40 animate-pulse rounded-2xl bg-foreground/[.04]" />
      ) : sets.length === 0 ? (
        <p className="py-10 text-center text-muted">No sets found. Try another search, or make the first one!</p>
      ) : (
        <SetGrid sets={sets} />
      )}
      {more && (
        <button type="button" onClick={() => setPage((p) => p + 1)} className={`${secondary} self-center`}>
          Load more
        </button>
      )}
    </div>
  );
}

type OpenGame = { code: string; mode: LiveMode; setTitle: string | null; hostName: string; status: string; players: number };

/** Live games their hosts listed on Discover: join one right now. Refreshes every 15 seconds. */
function OpenGames() {
  const [games, setGames] = useState<OpenGame[] | null>(null);
  useEffect(() => {
    const load = () =>
      fetch("/api/live/public", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { games: [] }))
        .then((d) => setGames(d.games ?? []))
        .catch(() => setGames((g) => g ?? []));
    void load();
    const t = setInterval(() => document.visibilityState === "visible" && void load(), 15_000);
    return () => clearInterval(t);
  }, []);
  if (!games || games.length === 0) return null;
  return (
    <section className={`${card} flex flex-col gap-3`}>
      <h2 className="font-semibold">🌍 Join a live game now</h2>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((g) => (
          <li key={g.code} className="flex items-center gap-3 rounded-xl border border-line p-3">
            <span className="text-3xl">{MODES[g.mode]?.icon ?? "🎮"}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{g.setTitle ?? MODES[g.mode]?.name ?? "Live game"}</span>
              <span className="block truncate text-xs text-muted">
                {MODES[g.mode]?.name} · hosted by {g.hostName} · {g.players} playing{g.status === "lobby" ? " · starting soon" : " · in progress"}
              </span>
            </span>
            <Link href={`/live/play/${g.code}`} className={`${primary} h-9 px-4`}>
              Join
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

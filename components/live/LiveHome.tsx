"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useScores } from "@/components/ScoresProvider";
import { signInHref } from "@/components/site/SiteHeader";
import type { SetSummary } from "@/lib/live/types";
import { card, input, primary, secondary } from "./ui";

export function LiveHome() {
  const { user } = useScores();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [sets, setSets] = useState<SetSummary[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/live/sets", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { sets: [] }))
      .then((d) => setSets(d.sets ?? []))
      .catch(() => setSets([]));
  }, [user]);

  const newSet = async () => {
    setBusy(true);
    const res = await fetch("/api/live/sets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled set", questions: [] }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) router.push(`/live/sets/${body.set.id}/edit`);
    else {
      setError(body.error ?? "Couldn't make a set.");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-accent">Jace Games Live</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Quiz the whole room.</h1>
          <p className="max-w-xl text-muted">
            Put questions on the big screen and everyone answers from their phone. Play Classic, race rockets, or rush for gold, with
            your own question set, one from Discover, or no questions at all.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {user ? (
              <Link href="/live/host/new" className={primary}>
                Host a game
              </Link>
            ) : (
              <a href={signInHref("/live")} className={primary}>
                Sign in to host
              </a>
            )}
            <Link href="/live/host/new?solo=1" className={secondary}>
              🎮 Play solo
            </Link>
            <Link href="/live/discover" className={secondary}>
              Discover sets
            </Link>
            <Link href="/live/maps" className={secondary}>
              Make maps
            </Link>
            <Link href="/live/locker" className={secondary}>
              🎽 Locker
            </Link>
            {user && (
              <Link href="/live/reports" className={secondary}>
                📋 Reports
              </Link>
            )}
          </div>
        </div>
        <form
          className={`${card} flex flex-col gap-3`}
          onSubmit={(e) => {
            e.preventDefault();
            if (/^\d{6}$/.test(code)) router.push(`/live/play/${code}`);
          }}
        >
          <h2 className="text-lg font-semibold">Join a game</h2>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="off"
            placeholder="Game code"
            aria-label="Game code"
            className={`${input} h-14 text-center font-mono text-2xl tracking-[0.4em]`}
          />
          <button type="submit" disabled={code.length !== 6} className={primary}>
            Join
          </button>
          <p className="text-center text-xs text-muted">No account needed to play.</p>
        </form>
      </section>

      {user && (
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Your sets</h2>
            <button type="button" onClick={newSet} disabled={busy} className={secondary}>
              + New set
            </button>
          </div>
          {error && <p className="mb-2 text-sm text-danger">{error}</p>}
          {sets === null ? (
            <div className="h-24 animate-pulse rounded-2xl bg-foreground/[.04]" />
          ) : sets.length === 0 ? (
            <p className="text-sm text-muted">No sets yet. Make one, or host something from Discover.</p>
          ) : (
            <SetGrid sets={sets} mine />
          )}
        </section>
      )}
    </div>
  );
}

export function SetGrid({ sets, mine = false }: { sets: SetSummary[]; mine?: boolean }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sets.map((s) => (
        <li key={s.id}>
          <Link
            href={mine ? `/live/sets/${s.id}/edit` : `/live/sets/${s.id}`}
            className="flex h-full flex-col gap-3 rounded-2xl border border-line bg-panel p-4 transition-colors hover:border-accent/50"
          >
            <div className="flex items-start gap-3">
              <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-foreground/[.05] text-2xl">
                {s.cover}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{s.title}</p>
                <p className="truncate text-xs text-muted">
                  {s.questionCount} question{s.questionCount === 1 ? "" : "s"} · {mine ? s.visibility : `by ${s.owner_name}`}
                </p>
              </div>
            </div>
            {s.description && <p className="line-clamp-2 text-sm text-muted">{s.description}</p>}
            <div className="mt-auto flex flex-wrap items-center gap-1.5 text-xs text-muted">
              {s.tags.map((t) => (
                <span key={t} className="rounded-full bg-foreground/[.06] px-2 py-0.5">
                  #{t}
                </span>
              ))}
              <span className="ml-auto">▶ {s.plays}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

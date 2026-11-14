"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useScores } from "@/components/ScoresProvider";
import { signInHref } from "@/components/site/SiteHeader";
import type { SetSummary } from "@/lib/live/types";
import { SetGrid } from "./LiveHome";
import { card, primary, secondary } from "./ui";

/** My sets: every question set you've made, and a button for a new one. */
export function MySets() {
  const { user } = useScores();
  const router = useRouter();
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
    const res = await fetch("/api/live/sets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Untitled set", questions: [] }) });
    const body = await res.json().catch(() => ({}));
    if (res.ok) router.push(`/live/sets/${body.set.id}/edit`);
    else {
      setError(body.error ?? "Couldn't make a set.");
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <div className={`${card} mx-auto flex max-w-md flex-col items-center gap-3 py-10 text-center`}>
        <p className="text-5xl">📚</p>
        <h1 className="font-display text-2xl font-extrabold">ur question sets</h1>
        <p className="text-sm text-muted">sign in w Jace to make sets, keep em, n host em for ur class or frens.</p>
        <a href={signInHref("/live/sets")} className={primary}>
          Sign in
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">📚 My sets</h1>
          <p className="text-muted">make a set, then host it or play it solo. ez</p>
        </div>
        <div className="flex gap-2">
          <Link href="/live/discover" className={secondary}>
            🔎 find sets
          </Link>
          <button type="button" onClick={newSet} disabled={busy} className={primary}>
            + new set
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {sets === null ? (
        <div className="h-32 animate-pulse rounded-3xl bg-foreground/[.04]" />
      ) : sets.length === 0 ? (
        <div className={`${card} flex flex-col items-center gap-3 py-12 text-center`}>
          <p className="text-5xl">✏️</p>
          <p className="text-lg font-semibold">no sets yet 😢</p>
          <p className="max-w-sm text-sm text-muted">rite ur own questions, import em from a spredsheet, or host somthing from Discover.</p>
          <button type="button" onClick={newSet} disabled={busy} className={primary}>
            make ur first set!!
          </button>
        </div>
      ) : (
        <SetGrid sets={sets} mine />
      )}
    </div>
  );
}

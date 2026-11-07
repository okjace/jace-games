"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useScores } from "@/components/ScoresProvider";
import { signInHref } from "@/components/site/SiteHeader";
import { MODES, type LiveMode, type SetSummary } from "@/lib/live/types";
import { card, primary, secondary } from "./ui";

/**
 * Choose what to host: a set (or none: players just tap a button) and a game
 * mode, then make the game and go to the host screen.
 */
export function HostSetup() {
  const { user } = useScores();
  const router = useRouter();
  const params = useSearchParams();
  const [setId, setSetId] = useState<string | null>(params.get("set"));
  const [chosen, setChosen] = useState<{ id: string; title: string; cover: string; questionCount: number } | null>(null);
  const [mine, setMine] = useState<SetSummary[]>([]);
  const [noSet, setNoSet] = useState(false);
  const [pickedMode, setMode] = useState<LiveMode>("classic");
  const [minutes, setMinutes] = useState(5);
  const [shuffle, setShuffle] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/live/sets", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { sets: [] }))
      .then((d) => setMine(d.sets ?? []))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!setId) return;
    fetch(`/api/live/sets/${setId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setChosen({ id: setId, title: d.set.title, cover: d.set.cover, questionCount: d.set.questions.length }))
      .catch(() => {});
  }, [setId]);

  // Classic needs questions, so with them off it becomes Gold Rush.
  const mode = noSet && MODES[pickedMode].needsSet ? "gold" : pickedMode;

  if (!user) {
    return (
      <div className={`${card} mx-auto max-w-md text-center`}>
        <p className="font-semibold">Sign in with Jace to host a game.</p>
        <a href={signInHref("/live/host/new")} className={`${primary} mt-4`}>
          Sign in with Jace
        </a>
      </div>
    );
  }

  const host = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/live/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setId: noSet ? null : setId, mode, settings: { minutes, shuffle } }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (res?.ok) router.push(`/live/host/${body.code}`);
    else {
      setError(body?.error ?? "Couldn't start the game.");
      setBusy(false);
    }
  };

  const ready = noSet || !!setId;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <h1 className="text-3xl font-bold tracking-tight">Host a game</h1>

      <section className={card}>
        <h2 className="text-sm font-semibold">1. Questions</h2>
        <label className="mt-3 flex items-center gap-3 rounded-xl border border-line p-3">
          <input type="checkbox" checked={noSet} onChange={(e) => setNoSet(e.target.checked)} className="h-5 w-5" />
          <span>
            <span className="block font-medium">No questions</span>
            <span className="block text-sm text-muted">Turn sets off: players tap a button instead of answering. Works with Gold Rush and Rocket Race.</span>
          </span>
        </label>
        {!noSet && (
          <div className="mt-3 flex flex-col gap-3">
            {chosen && chosen.id === setId ? (
              <div className="flex items-center gap-3 rounded-xl bg-accent/10 p-3 ring-1 ring-accent/40">
                <span className="text-3xl">{chosen.cover}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{chosen.title}</p>
                  <p className="text-xs text-muted">{chosen.questionCount} questions</p>
                </div>
                <button type="button" onClick={() => setSetId(null)} className="text-sm text-muted hover:text-foreground">
                  Change
                </button>
              </div>
            ) : (
              <>
                {mine.length > 0 && (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {mine.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => setSetId(s.id)}
                          disabled={s.questionCount === 0}
                          className="flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left hover:border-accent/50 disabled:opacity-50"
                        >
                          <span className="text-2xl">{s.cover}</span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{s.title}</span>
                            <span className="block text-xs text-muted">{s.questionCount} questions</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-sm text-muted">
                  Or find one on{" "}
                  <Link href="/live/discover" className="font-medium text-accent hover:underline">
                    Discover
                  </Link>{" "}
                  and press &ldquo;Host this set&rdquo;.
                </p>
              </>
            )}
          </div>
        )}
      </section>

      <section className={card}>
        <h2 className="text-sm font-semibold">2. Game mode</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {(Object.keys(MODES) as LiveMode[]).map((m) => {
            const def = MODES[m];
            const off = noSet && def.needsSet;
            return (
              <button
                key={m}
                type="button"
                disabled={off}
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={`flex flex-col gap-1 rounded-xl border p-4 text-left transition-colors disabled:opacity-40 ${mode === m ? "border-accent bg-accent/10" : "border-line hover:border-accent/50"}`}
              >
                <span className="text-3xl">{def.icon}</span>
                <span className="font-semibold">{def.name}</span>
                <span className="text-xs text-muted">{off ? "Needs a question set." : def.blurb}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          {MODES[mode].selfPaced ? (
            <label className="flex items-center gap-2">
              Time limit
              <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="h-9 rounded-full border border-line bg-background px-3">
                {[1, 2, 3, 5, 7, 10, 15, 20].map((n) => (
                  <option key={n} value={n}>
                    {n} min
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
              Shuffle question order
            </label>
          )}
        </div>
      </section>

      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={host} disabled={!ready || busy} className={primary}>
          {busy ? "Starting…" : "Create game"}
        </button>
        <Link href="/live" className={secondary}>
          Cancel
        </Link>
      </div>
    </div>
  );
}

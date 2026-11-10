"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { card, secondary } from "./ui";

type Reported = {
  setId: string;
  title: string;
  owner: string;
  visibility: string;
  removed: boolean;
  questions: number;
  reports: { by: string; reason: string; at: string }[];
};

/** /live/moderation: reported question sets, for the site owner to review. */
export function Moderation() {
  const [sets, setSets] = useState<Reported[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/live/admin/set-reports", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Couldn't load reports.");
        setSets(d.sets);
      })
      .catch((e) => setError(e.message));
  }, []);

  const takeDown = async (s: Reported, removed: boolean) => {
    const res = await fetch(`/api/live/sets/${s.setId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ removed }) }).catch(() => null);
    if (res?.ok) setSets((list) => (list ?? []).map((x) => (x.setId === s.setId ? { ...x, removed } : x)));
  };
  const dismiss = async (s: Reported) => {
    const res = await fetch(`/api/live/admin/set-reports?set=${s.setId}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) setSets((list) => (list ?? []).filter((x) => x.setId !== s.setId));
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <Link href="/live" className="text-sm text-muted hover:text-foreground">
          ← Live
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">🚩 Moderation</h1>
        <p className="text-muted">Question sets people reported. Taking one down hides it from Discover and stops it being hosted.</p>
      </div>
      {error ? (
        <p className={`${card} text-sm text-muted`}>{error}</p>
      ) : sets === null ? (
        <p className="animate-pulse text-muted">Loading…</p>
      ) : sets.length === 0 ? (
        <p className={`${card} text-sm text-muted`}>No reports right now. 🎉</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sets.map((s) => (
            <li key={s.setId} className={`${card} flex flex-col gap-3`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/live/sets/${s.setId}`} className="font-semibold hover:underline">
                    {s.title}
                  </Link>
                  <p className="text-xs text-muted">
                    by {s.owner} · {s.questions} questions · {s.visibility}
                    {s.removed && <b className="ml-1 text-danger">· taken down</b>}
                  </p>
                </div>
                <span className="rounded-full bg-danger/15 px-3 py-1 text-sm font-bold text-danger">
                  {s.reports.length} report{s.reports.length === 1 ? "" : "s"}
                </span>
              </div>
              <ul className="flex flex-col gap-1.5 text-sm">
                {s.reports.map((r, i) => (
                  <li key={i} className="rounded-lg bg-foreground/[.04] px-3 py-2">
                    &ldquo;{r.reason}&rdquo; <span className="text-xs text-muted">— {r.by}, {new Date(r.at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Link href={`/live/sets/${s.setId}`} className={secondary}>
                  Look at it
                </Link>
                {s.removed ? (
                  <button type="button" onClick={() => takeDown(s, false)} className={secondary}>
                    Put it back
                  </button>
                ) : (
                  <button type="button" onClick={() => takeDown(s, true)} className="h-11 rounded-full bg-danger px-5 text-sm font-semibold text-white">
                    Take it down
                  </button>
                )}
                <button type="button" onClick={() => dismiss(s)} className={secondary}>
                  Dismiss reports
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

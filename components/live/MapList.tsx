"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { THEMES, type MapTheme } from "@/lib/live/maps";
import { useScores } from "@/components/ScoresProvider";
import { signInHref } from "@/components/site/SiteHeader";
import { card, primary } from "./ui";

export type MapSummaryView = {
  id: string;
  title: string;
  owner_name: string;
  visibility: "public" | "private";
  plays: number;
  data: { cols: number; rows: number; theme: MapTheme; pathLength: number };
};

/** A small card for a map. */
export function MapCard({ m, href, onClick, selected }: { m: MapSummaryView; href?: string; onClick?: () => void; selected?: boolean }) {
  const t = THEMES[m.data.theme] ?? THEMES.meadow;
  const body = (
    <>
      <span className="block h-16 rounded-lg" style={{ background: `repeating-linear-gradient(45deg, ${t.grass[0]} 0 10px, ${t.grass[1]} 10px 20px)` }}>
        <span className="flex h-full items-center justify-center text-2xl">🏰</span>
      </span>
      <span className="mt-2 block truncate text-sm font-semibold">{m.title}</span>
      <span className="block text-xs text-muted">
        {m.data.cols}×{m.data.rows} · {m.data.pathLength} road · by {m.owner_name}
        {!m.id ? "" : m.visibility === "private" ? " · private" : ` · ${m.plays} ${m.plays === 1 ? "play" : "plays"}`}
      </span>
    </>
  );
  const cls = `block rounded-xl border p-3 text-left transition-colors ${selected ? "border-accent bg-accent/10" : "border-line hover:border-accent/50"}`;
  if (href) return <Link href={href} className={cls}>{body}</Link>;
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

export function MapList() {
  const { user } = useScores();
  const router = useRouter();
  const [lists, setLists] = useState<{ mine: MapSummaryView[]; public: MapSummaryView[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/live/maps", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setLists({ mine: d.mine ?? [], public: d.public ?? [] }))
      .catch(() => setLists({ mine: [], public: [] }));
  }, []);

  const create = async () => {
    setBusy(true);
    const res = await fetch("/api/live/maps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "My map" }) }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (res?.ok) router.push(`/live/maps/${body.map.id}/edit`);
    else {
      setError(body?.error ?? "Couldn't make a map.");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/live" className="text-sm text-muted hover:text-foreground">
            ← Live
          </Link>
          <h1 className="text-2xl font-bold">Tower Siege maps</h1>
          <p className="text-sm text-muted">Draw your own road, pick a look, and host Tower Siege on it.</p>
        </div>
        {user ? (
          <button type="button" onClick={create} disabled={busy} className={primary}>
            {busy ? "Making…" : "New map"}
          </button>
        ) : (
          <a href={signInHref("/live/maps")} className={primary}>
            Sign in to make maps
          </a>
        )}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {!lists ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <>
          {user && (
            <section>
              <h2 className="mb-2 text-sm font-semibold">Your maps</h2>
              {lists.mine.length ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {lists.mine.map((m) => (
                    <MapCard key={m.id} m={m} href={`/live/maps/${m.id}/edit`} />
                  ))}
                </div>
              ) : (
                <p className={`${card} text-sm text-muted`}>No maps yet. Make one!</p>
              )}
            </section>
          )}
          <section>
            <h2 className="mb-2 text-sm font-semibold">Popular maps</h2>
            {lists.public.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {lists.public.map((m) => (
                  <MapCard key={m.id} m={m} href={`/live/host/new?mode=tower&map=${m.id}`} />
                ))}
              </div>
            ) : (
              <p className={`${card} text-sm text-muted`}>Nobody has shared a map yet.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

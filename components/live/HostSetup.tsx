"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useScores } from "@/components/ScoresProvider";
import { signInHref } from "@/components/site/SiteHeader";
import { MODES, type LiveMode, type SetSummary } from "@/lib/live/types";
import { guestAvatar } from "./LiveAvatar";
import { MapCard, type MapSummaryView } from "./MapList";
import { card, primary, secondary, setToken } from "./ui";

/**
 * Choose what to host: a set (or none: players just tap a button) and a game
 * mode, then make the game and go to the host screen.
 */
type StudioPick = { id: string; title: string; icon: string; owner_name: string; plays: number; published: boolean; mine?: boolean };

export function HostSetup() {
  const { user } = useScores();
  const router = useRouter();
  const params = useSearchParams();
  const [setId, setSetId] = useState<string | null>(params.get("set"));
  const [chosen, setChosen] = useState<{ id: string; title: string; cover: string; questionCount: number } | null>(null);
  const [mine, setMine] = useState<SetSummary[]>([]);
  const [noSet, setNoSet] = useState(false);
  const [pickedMode, setMode] = useState<LiveMode>(() => {
    const m = params.get("mode");
    return m && m in MODES ? (m as LiveMode) : "classic";
  });
  const [mapId, setMapId] = useState<string | null>(params.get("map"));
  const soloFirst = params.get("solo") === "1";
  const [maps, setMaps] = useState<MapSummaryView[] | null>(null);
  const [gameId, setGameId] = useState<string | null>(params.get("game"));
  const [studioGames, setStudioGames] = useState<StudioPick[] | null>(null);
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

  // Maps for Tower Siege: yours first, then popular ones (the chosen one included even if it's someone else's).
  const wantMaps = pickedMode === "tower" && maps === null;
  useEffect(() => {
    if (!wantMaps) return;
    fetch("/api/live/maps", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { mine: [], public: [] }))
      .then((d) => setMaps([...(d.mine ?? []).filter((m: MapSummaryView) => m.data.pathLength > 0), ...(d.public ?? [])]))
      .catch(() => setMaps([]));
  }, [wantMaps]);

  const wantGames = pickedMode === "custom" && studioGames === null;
  useEffect(() => {
    if (!wantGames) return;
    fetch("/api/live/modes", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { mine: [], public: [] }))
      .then((d) => setStudioGames([...(d.mine ?? []).map((g: StudioPick) => ({ ...g, mine: true })), ...(d.public ?? [])]))
      .catch(() => setStudioGames([]));
  }, [wantGames]);

  useEffect(() => {
    if (!setId) return;
    fetch(`/api/live/sets/${setId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setChosen({ id: setId, title: d.set.title, cover: d.set.cover, questionCount: d.set.questions.length }))
      .catch(() => {});
  }, [setId]);

  // Classic needs questions, so with them off it becomes Gold Rush.
  const mode = noSet && MODES[pickedMode].needsSet ? "gold" : pickedMode;

  const picks = () => ({ setId: noSet ? null : setId, mode, settings: { minutes, shuffle, mapId: mode === "tower" ? mapId : null, gameId: mode === "custom" ? gameId : null } });

  const playSolo = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/live/solo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...picks(), avatar: guestAvatar() }) }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (res?.ok) {
      setToken(body.code, body.token);
      router.push(`/live/play/${body.code}`);
    } else {
      setError(body?.error ?? "Couldn't start the game.");
      setBusy(false);
    }
  };

  const host = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/live/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(picks()),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (res?.ok) router.push(`/live/host/${body.code}`);
    else {
      setError(body?.error ?? "Couldn't start the game.");
      setBusy(false);
    }
  };

  const ready = (noSet || !!setId) && (mode !== "custom" || !!gameId);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <h1 className="text-3xl font-bold tracking-tight">{soloFirst ? "Play solo" : "Host a game"}</h1>
      {soloFirst && <p className="-mt-3 text-muted">Pick a set and a mode and play on your own, no host or room needed.</p>}

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
        {mode === "custom" && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold">Studio game</span>
              <Link href="/studio" className="text-accent hover:underline">
                Make one in Game Studio →
              </Link>
            </div>
            {studioGames === null ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : studioGames.length === 0 ? (
              <p className="text-sm text-muted">
                No Studio games are Live modes yet. In Game Studio, open a game&apos;s settings and tick &ldquo;Let hosts use this as a Jace Games
                Live mode&rdquo;.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {studioGames.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={gameId === g.id}
                    onClick={() => setGameId(g.id)}
                    className={`rounded-xl border p-3 text-left transition-colors ${gameId === g.id ? "border-accent bg-accent/10" : "border-line hover:border-accent/50"}`}
                  >
                    <span className="text-2xl">{g.icon}</span>
                    <span className="mt-1 block truncate text-sm font-semibold">{g.title}</span>
                    <span className="block text-xs text-muted">
                      {g.mine ? (g.published ? "yours" : "yours · draft") : `by ${g.owner_name} · ${g.plays} plays`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {mode === "tower" && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold">Map</span>
              <Link href="/live/maps" className="text-accent hover:underline">
                Make your own map →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MapCard
                m={{ id: "", title: "Classic Meadow", owner_name: "Jace Games", visibility: "public", plays: 0, data: { cols: 12, rows: 8, theme: "meadow", pathLength: 23 } }}
                selected={!mapId}
                onClick={() => setMapId(null)}
              />
              {(maps ?? []).map((m) => (
                <MapCard key={m.id} m={m} selected={mapId === m.id} onClick={() => setMapId(m.id)} />
              ))}
            </div>
          </div>
        )}
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
      <div className="flex flex-wrap gap-2">
        {soloFirst || !user ? (
          <>
            <button type="button" onClick={playSolo} disabled={!ready || busy} className={primary}>
              {busy ? "Starting…" : "🎮 Play solo"}
            </button>
            {user ? (
              <button type="button" onClick={host} disabled={!ready || busy} className={secondary}>
                Host for a room instead
              </button>
            ) : (
              <a href={signInHref("/live/host/new")} className={secondary}>
                Sign in to host for a room
              </a>
            )}
          </>
        ) : (
          <>
            <button type="button" onClick={host} disabled={!ready || busy} className={primary}>
              {busy ? "Starting…" : "Create game"}
            </button>
            <button type="button" onClick={playSolo} disabled={!ready || busy} className={secondary}>
              🎮 Play solo
            </button>
          </>
        )}
        <Link href="/live" className={secondary}>
          Cancel
        </Link>
      </div>
    </div>
  );
}

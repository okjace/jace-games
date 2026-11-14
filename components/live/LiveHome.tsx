"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useScores } from "@/components/ScoresProvider";
import { signInHref } from "@/components/site/SiteHeader";
import { MODES, type LiveMode, type SetSummary } from "@/lib/live/types";
import { SEASONS, type SeasonId } from "@/lib/seasons";
import { JoinCodeForm } from "./JoinPage";
import { LiveGames } from "./LiveGames";
import { RejoinBanner } from "./RejoinBanner";
import { VerifiedBadge } from "./SetView";
import { primary, secondary } from "./ui";

/** Tile colours for the game modes (soft gradients that cycle). */
const TILES = [
  "from-orange-200 to-rose-200",
  "from-amber-200 to-lime-200",
  "from-sky-200 to-indigo-200",
  "from-emerald-200 to-teal-200",
  "from-fuchsia-200 to-pink-200",
  "from-violet-200 to-sky-200",
  "from-yellow-200 to-orange-200",
  "from-teal-200 to-cyan-200",
];

/** The Jace Live home page. */
export function LiveHome({ season }: { season: SeasonId }) {
  const { user } = useScores();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [sets, setSets] = useState<SetSummary[] | null>(null);
  const [featured, setFeatured] = useState<SetSummary[] | null>(null);
  const greeting = SEASONS[season].greeting;

  useEffect(() => {
    if (!user) return;
    fetch("/api/live/sets", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { sets: [] }))
      .then((d) => setSets(d.sets ?? []))
      .catch(() => setSets([]));
  }, [user]);

  useEffect(() => {
    fetch("/api/live/discover?verified=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { sets: [] }))
      .then((d) => setFeatured((d.sets ?? []).slice(0, 6)))
      .catch(() => setFeatured([]));
  }, []);

  const modes = (Object.keys(MODES) as LiveMode[]).filter((m) => m !== "custom");

  return (
    <div className="flex flex-col gap-12">
      <RejoinBanner />
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center">
        <div className="flex flex-col gap-4">
          {greeting && (
            <p className="w-fit rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">{greeting}</p>
          )}
          <h1 className="font-display text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
            play together,{" "}
            <span className="jl-shimmer bg-gradient-to-r from-[var(--accent)] via-[var(--accent2)] to-[var(--accent)] bg-clip-text text-transparent">LIVE!!</span>
          </h1>
          <p className="max-w-xl text-lg text-muted">
            throw a game on the big screen and evryone plays from there phone 📱 quizes, races, heists, towers, puzzels n way more. bring ur
            own questions, grab a set from Discover, or skip questions totally lol
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {user ? (
              <Link href="/live/host/new" className={`${primary} h-12 px-7 text-base`}>
                📺 host a game
              </Link>
            ) : (
              <a href={signInHref("/live/host/new")} className={`${primary} h-12 px-7 text-base`}>
                📺 sign in to host
              </a>
            )}
            <Link href="/live/host/new?solo=1" className={`${secondary} h-12`}>
              🎮 play solo
            </Link>
            <Link href="/live/discover" className={`${secondary} h-12`}>
              🔎 find sets
            </Link>
          </div>
        </div>
        <JoinCodeForm code={code} setCode={setCode} onJoin={(c) => router.push(`/live/play/${c}`)} />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-2">
          <h2 className="font-display text-3xl font-extrabold tracking-tight">pick ur game mode 🎲</h2>
          <p className="hidden text-sm text-muted sm:block">{modes.length} ways to play (thats a lot)</p>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {modes.map((m, i) => (
            <li key={m}>
              <Link
                href={`/live/host/new?mode=${m}`}
                style={{ animationDelay: `${i * 30}ms` }}
                className={`jl-pop-in group flex h-full flex-col gap-1.5 rounded-3xl bg-gradient-to-br ${TILES[i % TILES.length]} p-4 text-slate-900 shadow-[0_10px_24px_-16px_rgba(0,0,0,0.35)] transition-transform hover:-translate-y-1 hover:rotate-[-0.5deg]`}
              >
                <span className="text-4xl transition-transform group-hover:scale-110" aria-hidden="true">
                  {MODES[m].icon}
                </span>
                <span className="font-display text-lg font-extrabold leading-tight">{MODES[m].name}</span>
                <span className="line-clamp-3 text-xs text-slate-700">{MODES[m].blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-2">
          <h2 className="font-display text-3xl font-extrabold tracking-tight">🔴 live rn</h2>
          <Link href="/join" className="text-sm font-semibold text-accent hover:underline">
            see all →
          </Link>
        </div>
        <LiveGames embedded limit={4} />
      </section>

      {featured && featured.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-2">
            <h2 className="font-display text-3xl font-extrabold tracking-tight">✨ featured sets (the good stuff)</h2>
            <Link href="/live/discover" className="text-sm font-semibold text-accent hover:underline">
              find more →
            </Link>
          </div>
          <SetGrid sets={featured} />
        </section>
      )}

      {user && sets && sets.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-2">
            <h2 className="font-display text-3xl font-extrabold tracking-tight">📚 ur sets</h2>
            <Link href="/live/sets" className="text-sm font-semibold text-accent hover:underline">
              all my sets →
            </Link>
          </div>
          <SetGrid sets={sets.slice(0, 3)} mine />
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
            className="flex h-full flex-col gap-3 rounded-3xl border border-line bg-panel p-4 shadow-[0_10px_30px_-20px_rgba(30,20,10,0.3)] transition-[border-color,transform] hover:-translate-y-0.5 hover:border-accent/50"
          >
            <div className="flex items-start gap-3">
              <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-foreground/[.05] text-2xl">
                {s.cover}
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-semibold">
                  <span className="truncate">{s.title}</span>
                  {s.verified && <VerifiedBadge small />}
                </p>
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

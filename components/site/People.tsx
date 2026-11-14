"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useScores } from "@/components/ScoresProvider";
import { LiveAvatar, LiveName } from "@/components/live/LiveAvatar";
import { SetGrid } from "@/components/live/LiveHome";
import type { ThemeSummary } from "@/lib/customThemes";
import type { Avatar } from "@/lib/live/locker";
import { MODES, type LiveMode, type SetSummary } from "@/lib/live/types";
import { pickCustomTheme } from "./ThemeContext";

const box = "rounded-3xl border border-line bg-panel p-5 shadow-[0_10px_30px_-18px_rgba(30,20,10,0.25)]";
type Person = { username: string; displayName: string; bio: string; level: number; avatar: Avatar };
type Profile = Person & {
  xp: number;
  stats: { games: number; wins: number; right: number; bestStreak: number };
  badges: { id: string; emoji: string; name: string }[];
  sets: SetSummary[];
  themes: ThemeSummary[];
  bests: { mode: LiveMode; best: number }[];
};

/** /people: find public profiles. */
export function FindPeople() {
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Person[] | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/people?q=${encodeURIComponent(q)}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { people: [] }))
        .then((d) => setPeople(d.people ?? []))
        .catch(() => setPeople([]));
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">👥 find ppl</h1>
        <p className="text-muted">evryone who made their profile public. make urs public in ur <Link href="/profile" className="font-semibold text-accent hover:underline">profile settings</Link>!</p>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value.slice(0, 40))} placeholder="search by name…" aria-label="Search people" className="h-12 rounded-full border border-line bg-panel px-5 outline-none focus:border-accent" />
      {people === null ? (
        <div className="h-40 animate-pulse rounded-3xl bg-foreground/[.04]" />
      ) : people.length === 0 ? (
        <p className={`${box} text-center text-muted`}>nobody found 👀</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((p) => (
            <li key={p.username}>
              <Link href={`/u/${encodeURIComponent(p.username)}`} className={`${box} flex items-center gap-3 !p-4 transition-transform hover:-translate-y-0.5`}>
                <LiveAvatar avatar={p.avatar} size={48} />
                <span className="min-w-0 flex-1">
                  <LiveName name={p.displayName} avatar={p.avatar} className="block truncate font-bold" />
                  <span className="block truncate text-xs text-muted">@{p.username} · lv {p.level}</span>
                  {p.bio && <span className="block truncate text-xs">{p.bio}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** /u/[username]: someone's public profile. */
export function PublicProfile({ username }: { username: string }) {
  const { user } = useScores();
  const [p, setP] = useState<Profile | null | "missing">(null);
  useEffect(() => {
    fetch(`/api/people/${encodeURIComponent(username)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setP(d?.profile ?? "missing"))
      .catch(() => setP("missing"));
  }, [username]);
  if (p === null) return <div className="h-64 animate-pulse rounded-3xl bg-foreground/[.04]" />;
  if (p === "missing")
    return (
      <div className={`${box} mx-auto flex max-w-md flex-col items-center gap-2 py-10 text-center`}>
        <p className="text-5xl">🔒</p>
        <p className="font-display text-2xl font-extrabold">this profile is private</p>
        <p className="text-sm text-muted">(or it doesnt exist. one of the two 🤷)</p>
        <Link href="/people" className="text-sm font-semibold text-accent hover:underline">
          find ppl →
        </Link>
      </div>
    );
  const mine = user?.username?.toLowerCase() === p.username.toLowerCase();
  return (
    <div className="flex flex-col gap-5">
      <section className={`${box} flex flex-wrap items-center gap-5`}>
        <LiveAvatar avatar={p.avatar} size={96} />
        <div className="min-w-0 flex-1">
          <LiveName name={p.displayName} avatar={p.avatar} className="font-display text-3xl font-extrabold" />
          <p className="text-sm text-muted">
            @{p.username} · level {p.level} · {p.xp.toLocaleString()} XP
          </p>
          {p.bio && <p className="mt-1">{p.bio}</p>}
        </div>
        {mine && (
          <Link href="/profile" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:bg-accent/10">
            ✏️ edit
          </Link>
        )}
      </section>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["🎮", "games", p.stats.games],
          ["🏆", "wins", p.stats.wins],
          ["✅", "right ansers", p.stats.right],
          ["🔥", "best streak", p.stats.bestStreak],
        ].map(([icon, label, n]) => (
          <div key={String(label)} className={`${box} !p-4 text-center`}>
            <p className="text-2xl">{icon}</p>
            <p className="font-display text-2xl font-extrabold">{Number(n).toLocaleString()}</p>
            <p className="text-xs text-muted">{label}</p>
          </div>
        ))}
      </section>
      {p.badges.length > 0 && (
        <section className={box}>
          <h2 className="mb-3 font-display text-xl font-extrabold">🏅 badges</h2>
          <ul className="flex flex-wrap gap-2">
            {p.badges.map((b) => (
              <li key={b.id} className="rounded-full bg-foreground/[.05] px-3 py-1.5 text-sm font-semibold">
                {b.emoji} {b.name}
              </li>
            ))}
          </ul>
        </section>
      )}
      {p.bests.length > 0 && (
        <section className={box}>
          <h2 className="mb-3 font-display text-xl font-extrabold">🏆 leaderboard bests</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {p.bests.map((b) => (
              <li key={b.mode}>
                <Link href={`/leaderboards?mode=${b.mode}`} className="flex items-center gap-2 rounded-2xl bg-foreground/[.04] px-3 py-2 text-sm hover:bg-accent/10">
                  <span className="text-xl">{MODES[b.mode].icon}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{MODES[b.mode].name}</span>
                  <span className="font-mono tabular-nums">{MODES[b.mode].unit(b.best)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {p.sets.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-extrabold">📚 sets</h2>
          <SetGrid sets={p.sets} />
        </section>
      )}
      {p.themes.length > 0 && (
        <section className={box}>
          <h2 className="mb-3 font-display text-xl font-extrabold">🎨 themes</h2>
          <ul className="flex flex-wrap gap-2">
            {p.themes.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => pickCustomTheme(t)} className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:bg-accent/10" title="try this theme">
                  {t.icon} {t.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** In account settings: make ur profile public, write a bio, copy the link. */
export function PublicProfileCard() {
  const { user } = useScores();
  const [on, setOn] = useState<boolean | null>(null);
  const [bio, setBio] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    fetch("/api/me/prefs", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setOn(!!d?.prefs?.publicProfile);
        setBio(d?.prefs?.bio ?? "");
      })
      .catch(() => setOn(false));
  }, [user]);
  if (!user || on === null) return null;
  const link = typeof window !== "undefined" ? `${window.location.origin}/u/${encodeURIComponent(user.username)}` : "";
  const save = async (patch: { publicProfile?: boolean; bio?: string }) => {
    const res = await fetch("/api/me/prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).catch(() => null);
    setMsg(res?.ok ? "saved ✅" : "couldnt save :(");
  };
  return (
    <section className={box}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold">🌍 public profile</h2>
        <button
          type="button"
          onClick={() => {
            setOn(!on);
            void save({ publicProfile: !on });
          }}
          aria-pressed={on}
          className={`rounded-full px-4 py-1.5 text-sm font-bold ${on ? "bg-accent text-on-accent" : "border border-line"}`}
        >
          {on ? "✅ public" : "🔒 private"}
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">public = anyone can see ur look, level, badges, public sets, themes n leaderboard bests at ur link, n find u on the find ppl page.</p>
      {on && (
        <div className="mt-3 flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            bio
            <input value={bio} maxLength={160} onChange={(e) => setBio(e.target.value)} onBlur={() => void save({ bio })} placeholder="say hi 👋" className="h-10 rounded-xl border border-line bg-background/60 px-3 outline-none focus:border-accent" />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl bg-foreground/[.05] px-3 py-2 text-xs">{link}</code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(link).catch(() => {});
                setMsg("link copied 🔗");
              }}
              className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:bg-accent/10"
            >
              🔗 copy link
            </button>
            <Link href={`/u/${encodeURIComponent(user.username)}`} className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:bg-accent/10">
              👀 see it
            </Link>
          </div>
        </div>
      )}
      {msg && <p className="mt-2 text-xs font-semibold">{msg}</p>}
    </section>
  );
}

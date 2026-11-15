"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useScores } from "@/components/ScoresProvider";
import type { Avatar } from "@/lib/live/locker";
import { MODES, type LiveMode } from "@/lib/live/types";
import { LiveAvatar } from "./LiveAvatar";
import { card, primary, secondary } from "./ui";

type Row = { name: string; best: number; avatar: Avatar | null; you: boolean };
type Data = { week: string; mode: LiveMode; endsAt: number; top: Row[]; last: { week: string; mode: LiveMode; top: Row[] }; prize: { place: number } | null };

const timeLeft = (ms: number) => {
  const h = Math.max(0, Math.floor(ms / 3_600_000));
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${Math.max(0, Math.floor((ms % 3_600_000) / 60_000))}m`;
};

/** This week's featured mode and its leaderboard, last week's winners, and claiming a prize. */
export function WeeklyChallenge() {
  const { user } = useScores();
  const [d, setD] = useState<Data | null>(null);
  const [now, setNow] = useState(0);
  const [claim, setClaim] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/live/weekly", { cache: "no-store" })
      .then((r) => r.json())
      .then(setD)
      .catch(() => {});
    const t = setInterval(() => setNow(Date.now()), 30_000);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    return () => clearInterval(t);
  }, []);
  if (!d) return <div className="h-80 animate-pulse rounded-3xl bg-foreground/[.04]" />;
  const def = MODES[d.mode];
  const doClaim = async () => {
    const res = await fetch("/api/live/weekly/claim", { method: "POST" }).catch(() => null);
    const b = await res?.json().catch(() => null);
    setClaim(res?.ok ? `🎉 got it: ${b.items.join(", ")}! (they're in ur locker)` : (b?.error ?? "couldnt claim :("));
    if (res?.ok) setD({ ...d, prize: null });
  };
  const board = (rows: Row[], unit: (n: number) => string) => (
    <ol className="flex flex-col gap-1.5">
      {rows.map((r, i) => (
        <li key={`${r.name}-${i}`} className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${r.you ? "ring-2 ring-accent" : i < 3 ? "bg-accent/10" : "odd:bg-foreground/[.03]"}`}>
          <span className="w-8 text-center text-lg font-black">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
          <LiveAvatar avatar={r.avatar} size={30} />
          <span className="min-w-0 flex-1 truncate font-semibold">
            {r.name} {r.you && <span className="text-xs text-accent">(u)</span>}
          </span>
          <span className="font-mono font-bold tabular-nums">{unit(r.best)}</span>
        </li>
      ))}
    </ol>
  );
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">🗓️ weekly challenge</h1>
        <p className="text-muted">one mode a week. top 3 when it ends win prizes u cant get anywhere else!! 🏆</p>
      </div>
      {d.prize && (
        <div className={`${card} flex flex-wrap items-center gap-3 border-2 border-amber-400`}>
          <span className="text-4xl">🏆</span>
          <p className="min-w-0 flex-1 font-bold">u came #{d.prize.place} in last week&apos;s challenge!! claim ur prize:</p>
          <button type="button" onClick={() => void doClaim()} className={primary}>
            🎁 claim it
          </button>
        </div>
      )}
      {claim && <p className="font-semibold">{claim}</p>}
      <section className={`${card} flex flex-col gap-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-5xl">{def.icon}</span>
            <div>
              <p className="text-sm font-bold text-muted">this week</p>
              <p className="font-display text-3xl font-extrabold">{def.name}</p>
              <p className="text-sm text-muted">{now ? `ends in ${timeLeft(d.endsAt - now)}` : ""}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/live/host/new?mode=${d.mode}&solo=1`} className={primary}>
              🎮 play solo
            </Link>
            {user && (
              <Link href={`/live/host/new?mode=${d.mode}`} className={secondary}>
                📺 host it
              </Link>
            )}
          </div>
        </div>
        <p className="text-sm text-muted">{def.blurb}</p>
        <p className="text-xs text-muted">to get on here: finish a {def.name} game signed in, then hit &ldquo;yes pls&rdquo; to go on the leaderboards. ur best this week counts. prizes: 🥇 gold frame + 🏆 icon + title · 🥈🥉 🎖️ icon + title.</p>
        {d.top.length === 0 ? <p className="py-6 text-center text-muted">nobody yet this week. be the frist!!</p> : board(d.top, def.unit)}
      </section>
      {d.last.top.length > 0 && (
        <section className={`${card} flex flex-col gap-3`}>
          <p className="font-display text-xl font-extrabold">
            last week: {MODES[d.last.mode].icon} {MODES[d.last.mode].name}
          </p>
          {board(d.last.top, MODES[d.last.mode].unit)}
        </section>
      )}
    </div>
  );
}

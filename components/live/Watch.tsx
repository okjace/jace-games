"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SpectatorView } from "@/lib/live/engine";
import { TEAMS } from "@/lib/live/teams";
import { MODES } from "@/lib/live/types";
import { TeamBoard } from "./HostTeams";
import { LiveAvatar } from "./LiveAvatar";
import { TournamentBoard } from "./Tournament";
import { card, clock } from "./ui";

/**
 * Watching a game without playing: the scores, teams, the question on screen
 * and the clock, checked every couple of seconds. Spectators never see chat.
 */
export function Watch({ code }: { code: string }) {
  const [view, setView] = useState<SpectatorView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  // The server's clock vs this device's (worked out when each update arrives).
  const [skew, setSkew] = useState(0);
  useEffect(() => {
    let live = true;
    const load = async () => {
      const res = await fetch(`/api/live/games/${code}/watch`, { cache: "no-store" }).catch(() => null);
      const body = await res?.json().catch(() => null);
      if (!live) return;
      if (!res?.ok) setError(body?.error ?? "Couldn't load that game.");
      else {
        setView(body);
        setSkew(body.serverNow - Date.now());
        setError(null);
      }
    };
    void load();
    const t = setInterval(() => document.visibilityState === "visible" && void load(), 2000);
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => {
      live = false;
      clearInterval(t);
      clearInterval(tick);
    };
  }, [code]);

  if (error && !view) return <p className={`${card} text-center text-muted`}>{error}</p>;
  if (!view) return <div className="h-80 animate-pulse rounded-3xl bg-foreground/[.04]" />;
  const def = MODES[view.mode];
  const left = view.endsAt && now ? Math.max(0, Math.ceil((view.endsAt - (now + skew)) / 1000)) : null;
  const top = Math.max(1, ...view.players.map((p) => p.score));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-muted">👀 watching · code {view.code}</p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            {def.icon} {def.name}
          </h1>
          <p className="text-sm text-muted">
            {view.setTitle ? `${view.setTitle} · ` : ""}hosted by {view.host} · {view.players.length} playing
          </p>
        </div>
        <div className="flex items-center gap-2">
          {view.status === "playing" && <span className="rounded-full bg-accent/15 px-4 py-2 font-mono text-2xl font-black tabular-nums">{view.endsAt ? clock(left) : "♾️"}</span>}
          {view.status !== "ended" && (
            <Link href={`/live/play/${view.code}`} className="rounded-full bg-accent px-4 py-2 font-bold text-on-accent">
              🎮 join instead
            </Link>
          )}
        </div>
      </div>

      {view.status === "lobby" && <p className={`${card} text-center text-lg font-semibold`}>⏳ waitin for the host to start…</p>}
      {view.status === "ended" && (
        <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
          <p className="text-lg font-bold">🏁 game over! {view.players[0] ? `🥇 ${view.players[0].name} won` : ""}</p>
          {view.replay && (
            <Link href={`/replay/${view.replay}`} className="rounded-full border border-line px-4 py-2 font-semibold hover:bg-accent/10">
              🎬 watch the replay
            </Link>
          )}
        </div>
      )}
      {view.tournament && view.status === "ended" && <TournamentBoard t={view.tournament} />}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          {view.question && (
            <section className={`${card} flex flex-col gap-2`}>
              <p className="text-xs font-bold text-muted">
                ❓ question {view.question.index + 1} of {view.question.total}
              </p>
              <p className="font-display text-2xl font-bold">{view.question.prompt}</p>
              {view.question.choices && (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {view.question.choices.map((c, i) => {
                    const right = view.question!.right?.split(" / ").includes(c);
                    return (
                      <li key={i} className={`rounded-xl border px-3 py-2 font-semibold ${right ? "border-emerald-500 bg-emerald-500/15" : "border-line"}`}>
                        {right ? "✅ " : ""}
                        {c}
                      </li>
                    );
                  })}
                </ul>
              )}
              {!view.question.choices && view.question.right && <p className="font-semibold">✅ {view.question.right}</p>}
            </section>
          )}
          <section className={`${card} flex flex-col gap-1.5`}>
            <p className="font-display text-xl font-extrabold">🏆 leaderboard</p>
            {view.players.length === 0 && <p className="text-sm text-muted">nobody&apos;s joined yet</p>}
            {view.players.map((p, i) => (
              <div key={`${p.name}-${i}`} className="flex items-center gap-2 text-sm">
                <span className="w-6 text-center font-black">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
                <LiveAvatar avatar={p.avatar} size={22} />
                <span className="w-32 shrink-0 truncate font-semibold">{p.name}</span>
                <span className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-foreground/[.06]">
                  <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${(p.score / top) * 100}%`, background: p.team !== null && TEAMS[p.team] ? TEAMS[p.team].color : "var(--accent)" }} />
                </span>
                <span className="w-20 text-right font-mono tabular-nums">{def.unit(p.score)}</span>
              </div>
            ))}
          </section>
        </div>
        <div className="flex flex-col gap-4">
          {view.teams && <TeamBoard teams={view.teams} />}
          <p className="text-xs text-muted">ur just watching: u wont see the chat, and nobody sees u. updates every couple seconds.</p>
        </div>
      </div>
    </div>
  );
}

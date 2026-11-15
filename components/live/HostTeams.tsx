"use client";

import type { HostView } from "@/lib/live/engine";
import { TEAMS, type TeamScore, type TeamSettings } from "@/lib/live/teams";
import { LiveAvatar, LiveName } from "./LiveAvatar";
import { TeamBadge, TeamSetup } from "./TeamSetup";
import { card } from "./ui";

type Act = (action: string, extra?: Record<string, unknown>) => void;

/** The host's lobby with teams: a column per team, move anyone, shuffle, or change the setup. */
export function HostTeamLobby({ view, act, onKick }: { view: HostView; act: Act; onKick: (id: string, name: string) => void }) {
  const t = view.settings.teams as TeamSettings | null | undefined;
  if (!t) return null;
  const columns: { team: number | null; players: HostView["players"] }[] = [
    ...Array.from({ length: t.count }, (_, i) => ({ team: i as number | null, players: view.players.filter((p) => p.team === i) })),
    { team: null, players: view.players.filter((p) => p.team === null) },
  ];
  return (
    <div className="flex w-full flex-col gap-3 text-left">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-xl font-extrabold">👥 teams</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => act("teams-shuffle")} className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:bg-accent/10">
            🎲 shuffle evryone
          </button>
        </div>
      </div>
      <details className="rounded-2xl border border-line p-3 text-sm">
        <summary className="cursor-pointer font-semibold">⚙️ change team setup</summary>
        <div className="mt-3">
          <TeamSetup value={t} onChange={(teams) => act("teams", { teams })} />
        </div>
      </details>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {columns.map((c) =>
          c.team === null && c.players.length === 0 ? null : (
            <div key={c.team ?? "none"} className="rounded-2xl border-2 p-2" style={{ borderColor: c.team === null ? "var(--line)" : TEAMS[c.team].color }}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                {c.team === null ? <span className="text-sm font-bold text-muted">🤷 no team yet</span> : <TeamBadge team={c.team} />}
                <span className="text-xs text-muted">{c.players.length}</span>
              </div>
              <ul className="flex flex-col gap-1">
                {c.players.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 rounded-xl bg-foreground/[.05] py-1 pl-1 pr-1.5 text-sm">
                    <LiveAvatar avatar={p.avatar} size={24} />
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      <LiveName name={p.name} avatar={p.avatar} />
                    </span>
                    <select
                      aria-label={`Team for ${p.name}`}
                      value={p.team ?? ""}
                      onChange={(e) => act("team-set", { playerId: p.id, team: Number(e.target.value) })}
                      className="h-7 rounded-full border border-line bg-background px-1 text-xs"
                    >
                      {p.team === null && <option value="">move to…</option>}
                      {TEAMS.slice(0, t.count).map((tm, i) => (
                        <option key={tm.name} value={i}>
                          {tm.icon} {tm.name}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => onKick(p.id, p.name)} title="Remove from the game" aria-label={`Remove ${p.name}`} className="rounded-full px-1.5 text-muted hover:bg-danger/15 hover:text-danger">
                      ✕
                    </button>
                  </li>
                ))}
                {c.players.length === 0 && <li className="px-1 py-1 text-xs text-muted">nobody yet</li>}
              </ul>
            </div>
          ),
        )}
      </div>
      <p className="text-xs text-muted">
        {t.pick === "players" ? "playas pick their own team on their screen." : t.pick === "random" ? "teams got dealt out at random (shuffle to redo)." : "use the menus to put people on teams."} anyone without a team when u start goes on the smallest one.
      </p>
    </div>
  );
}

/** Every team's total, biggest first. `big` for the end-of-game podium. */
export function TeamBoard({ teams, big = false, mine = null }: { teams: TeamScore[]; big?: boolean; mine?: number | null }) {
  const top = Math.max(1, ...teams.map((t) => t.score));
  return (
    <div className={`${card} flex flex-col gap-2`}>
      <p className={`font-display font-extrabold ${big ? "text-3xl" : "text-xl"}`}>{big ? `🏆 ${teams[0]?.icon ?? ""} ${teams[0]?.name ?? ""} win!!` : "👥 team scores"}</p>
      <ol className="flex flex-col gap-1.5">
        {teams.map((t) => (
          <li key={t.team} className={`flex flex-col gap-1 rounded-xl px-2 py-1 ${mine === t.team ? "ring-2 ring-accent" : ""}`}>
            <div className="flex items-center gap-2">
              <span className="w-7 text-center font-black">{t.rank === 1 ? "🥇" : t.rank === 2 ? "🥈" : t.rank === 3 ? "🥉" : t.rank}</span>
              <span className="text-lg">{t.icon}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">
                {t.name} <span className="text-xs font-normal text-muted">({t.players})</span>
                {mine === t.team && <span className="ml-1 text-xs font-bold text-accent">← u</span>}
              </span>
              <span className="font-mono font-bold tabular-nums">{t.score.toLocaleString()}</span>
            </div>
            <div className="ml-9 h-2 overflow-hidden rounded-full bg-foreground/[.06]">
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(t.score / top) * 100}%`, background: t.color }} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** A player's lobby: pick ur team (when the host lets players pick), or see which one ur on. */
export function PlayerTeamPicker({ teams, busy, onPick }: { teams: NonNullable<import("@/lib/live/engine").PlayerView["teams"]>; busy: boolean; onPick: (team: number) => void }) {
  const mine = teams.mine;
  if (teams.pick !== "players") {
    return mine !== null ? (
      <p className="flex items-center gap-2 text-lg font-bold">
        ur on <TeamBadge team={mine} />
      </p>
    ) : (
      <p className="text-sm text-muted">{teams.pick === "host" ? "the host will put u on a team 👀" : "teams get picked at random"}</p>
    );
  }
  const counts = new Map(teams.scores.map((t) => [t.team, t.players]));
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <p className="font-bold">{mine === null ? "pick ur team!!" : "ur team (u can still switch)"}</p>
      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3">
        {[...teams.scores].sort((a, b) => a.team - b.team).map((t) => (
          <button
            key={t.team}
            type="button"
            disabled={busy}
            onClick={() => onPick(t.team)}
            aria-pressed={mine === t.team}
            className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-2 text-left font-bold transition-transform hover:-translate-y-0.5 disabled:opacity-60 ${mine === t.team ? "text-white shadow-lg" : "bg-panel"}`}
            style={{ borderColor: t.color, ...(mine === t.team ? { background: t.color } : {}) }}
          >
            <span className="text-2xl">{t.icon}</span>
            <span className="min-w-0 flex-1 truncate">{t.name}</span>
            <span className="text-xs opacity-80">{counts.get(t.team) ?? 0}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

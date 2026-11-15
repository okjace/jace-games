"use client";

import type { TournamentView } from "@/lib/live/engine";
import { MAX_ROUNDS, PLACE_POINTS } from "@/lib/live/tournament";
import { MODES, type LiveMode } from "@/lib/live/types";
import { Celebration, LiveAvatar } from "./LiveAvatar";
import { card } from "./ui";

/** The host's tournament lineup: 2–6 modes in order. `null` = no tournament. */
export function TournamentSetup({ rounds, onChange, noSet }: { rounds: LiveMode[] | null; onChange: (r: LiveMode[] | null) => void; noSet: boolean }) {
  const allowed = (Object.keys(MODES) as LiveMode[]).filter((m) => m !== "custom" && m !== "rare" && !(noSet && MODES[m].needsSet));
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 font-semibold">
        <input type="checkbox" checked={!!rounds} onChange={(e) => onChange(e.target.checked ? [allowed[0], allowed[1]] : null)} />
        🏆 tournament (play a few modes back to back)
      </label>
      {rounds && (
        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-background/50 p-3">
          <ol className="flex flex-col gap-1.5">
            {rounds.map((m, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="w-16 shrink-0 font-bold text-muted">round {i + 1}</span>
                <select
                  value={m}
                  aria-label={`Round ${i + 1} mode`}
                  onChange={(e) => onChange(rounds.map((r, j) => (j === i ? (e.target.value as LiveMode) : r)))}
                  className="h-9 min-w-0 flex-1 rounded-full border border-line bg-background px-3"
                >
                  {allowed.map((a) => (
                    <option key={a} value={a}>
                      {MODES[a].icon} {MODES[a].name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={rounds.length <= 2}
                  onClick={() => onChange(rounds.filter((_, j) => j !== i))}
                  aria-label={`Remove round ${i + 1}`}
                  className="rounded-full px-2 py-1 text-muted hover:bg-danger/15 hover:text-danger disabled:opacity-30"
                >
                  ✕
                </button>
              </li>
            ))}
          </ol>
          {rounds.length < MAX_ROUNDS && (
            <button type="button" onClick={() => onChange([...rounds, allowed[(rounds.length * 3) % allowed.length]])} className="self-start rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:bg-accent/10">
              ➕ add a round
            </button>
          )}
          <p className="text-xs text-muted">
            after each round: {PLACE_POINTS.slice(0, 3).join(", ")}… points for 1st, 2nd, 3rd (evryone gets at least 1). most points after the last round wins! the mode u picked above is ignored, round 1 goes first.
          </p>
        </div>
      )}
    </div>
  );
}

/** Tournament standings: after a round, or the final trophy screen. */
export function TournamentBoard({ t, onNext, busy = false }: { t: TournamentView; onNext?: () => void; busy?: boolean }) {
  const next = t.rounds[t.round + 1];
  const champ = t.standings[0];
  return (
    <section className={`${card} flex flex-col gap-3`}>
      {t.done && champ && <Celebration effect={champ.avatar?.effect} />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl font-extrabold">{t.done ? "🏆 tournament champion!!" : `🏆 after round ${t.round + 1} of ${t.rounds.length}`}</h2>
        <ol className="flex flex-wrap gap-1 text-lg" aria-label="Rounds">
          {t.rounds.map((m, i) => (
            <li key={i} title={`Round ${i + 1}: ${MODES[m].name}`} className={`rounded-full px-1.5 ${i < t.round || t.done ? "opacity-50" : i === t.round ? "bg-accent/15" : ""}`}>
              {MODES[m].icon}
            </li>
          ))}
        </ol>
      </div>
      {t.done && champ && (
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <span className="text-6xl">🏆</span>
          <LiveAvatar avatar={champ.avatar} size={64} />
          <p className="font-display text-3xl font-extrabold">{champ.name}</p>
          <p className="text-muted">{champ.tp} points</p>
        </div>
      )}
      {t.teams && (
        <div className="flex flex-wrap gap-2">
          {t.teams.map((tm) => (
            <span key={tm.team} className="rounded-full px-3 py-1 text-sm font-bold text-white" style={{ background: tm.color }}>
              {tm.place === 1 ? "👑 " : `#${tm.place} `}
              {tm.icon} {tm.name} · {tm.tp}
            </span>
          ))}
        </div>
      )}
      <ol className="flex flex-col gap-1">
        {t.standings.slice(0, 15).map((p, i) => (
          <li key={`${p.name}-${i}`} className={`flex items-center gap-3 rounded-xl px-3 py-1.5 ${p.you ? "ring-2 ring-accent" : "odd:bg-foreground/[.03]"}`}>
            <span className="w-7 text-center font-black">{p.place === 1 ? "🥇" : p.place === 2 ? "🥈" : p.place === 3 ? "🥉" : p.place}</span>
            <LiveAvatar avatar={p.avatar} size={24} />
            <span className="min-w-0 flex-1 truncate font-semibold">
              {p.name}
              {p.you && <span className="ml-1 text-xs text-accent">(u)</span>}
            </span>
            {p.last > 0 && <span className="text-xs text-muted">+{p.last}</span>}
            <span className="font-mono font-bold tabular-nums">{p.tp}</span>
          </li>
        ))}
      </ol>
      {!t.done && next && (onNext ? (
        <button type="button" disabled={busy} onClick={onNext} className="self-start rounded-full bg-accent px-5 py-2.5 font-bold text-on-accent disabled:opacity-60">
          ▶️ next round: {MODES[next].icon} {MODES[next].name}
        </button>
      ) : (
        <p className="text-sm font-semibold text-muted">
          next up: {MODES[next].icon} {MODES[next].name}. wait for the host!
        </p>
      ))}
    </section>
  );
}

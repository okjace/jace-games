"use client";

import { MAX_TEAMS, TEAMS, type TeamPick, type TeamSettings } from "@/lib/live/teams";

const PICKS: { id: TeamPick; label: string; note: string }[] = [
  { id: "players", label: "🙋 playas pick", note: "everyone picks a team in the lobby" },
  { id: "host", label: "📺 i pick", note: "u put people on teams" },
  { id: "random", label: "🎲 random", note: "teams get dealt out evenly" },
];

/** Teams on/off, how many (2–12), and how people get on one. `value` null = no teams. */
export function TeamSetup({ value, onChange, disabled = false }: { value: TeamSettings | null; onChange: (t: TeamSettings | null) => void; disabled?: boolean }) {
  const on = !!value;
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 font-semibold">
        <input type="checkbox" checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked ? { count: 2, pick: "players" } : null)} />
        👥 play in teams
      </label>
      {value && (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-background/50 p-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">how many teams ({value.count})</span>
            <input type="range" min={2} max={MAX_TEAMS} value={value.count} disabled={disabled} onChange={(e) => onChange({ ...value, count: Number(e.target.value) })} className="accent-[var(--accent)]" />
            <span className="flex flex-wrap gap-1">
              {TEAMS.slice(0, value.count).map((t) => (
                <span key={t.name} className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: t.color }}>
                  {t.icon} {t.name}
                </span>
              ))}
            </span>
          </label>
          <div className="flex flex-col gap-1 text-sm" role="radiogroup" aria-label="How people get on a team">
            <span className="font-semibold">who picks the teams?</span>
            <div className="flex flex-wrap gap-1.5">
              {PICKS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={value.pick === p.id}
                  disabled={disabled}
                  onClick={() => onChange({ ...value, pick: p.id })}
                  title={p.note}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold ${value.pick === p.id ? "bg-accent text-on-accent" : "border border-line hover:bg-accent/10"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted">{PICKS.find((p) => p.id === value.pick)?.note}. anyone without a team when it starts goes on the smallest one.</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** A team's badge: its emoji and name in its colour. */
export function TeamBadge({ team, small = false }: { team: number | null | undefined; small?: boolean }) {
  if (team === null || team === undefined || !TEAMS[team]) return null;
  const t = TEAMS[team];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full font-bold text-white ${small ? "px-1.5 py-0 text-[11px]" : "px-2.5 py-0.5 text-sm"}`} style={{ background: t.color }}>
      {t.icon} {t.name}
    </span>
  );
}

"use client";

import { SEASONS } from "@/lib/seasons";
import { EffectsToggle } from "./Seasonal";
import { LookToggle } from "./LookToggle";
import { SPECIAL_MODES, toggleMode, useModes, useSeason } from "./ThemeContext";

/** In account settings: special modes and the falling-stuff switch (saved to ur account). */
export function SpecialModesCard() {
  const modes = useModes();
  const season = useSeason();
  return (
    <section className="rounded-3xl border border-line bg-panel p-5 shadow-[0_10px_30px_-18px_rgba(30,20,10,0.25)]">
      <h2 className="mb-2 font-display text-xl font-bold">🌗 light or dark</h2>
      <div className="mb-4 max-w-sm">
        <LookToggle />
      </div>
      <h2 className="mb-1 font-display text-xl font-bold">✨ special modes</h2>
      <p className="mb-3 text-xs text-muted">saved to ur account, so they follow u to any device.</p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {SPECIAL_MODES.map((m) => {
          const on = modes.includes(m.id);
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => toggleMode(m.id)}
                aria-pressed={on}
                className={`flex h-full w-full items-start gap-2 rounded-2xl border p-3 text-left transition-colors ${on ? "border-accent bg-accent/10 ring-2 ring-accent/40" : "border-line hover:border-accent/40"}`}
              >
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 text-xs ${on ? "border-accent bg-accent text-on-accent" : "border-line"}`}>{on ? "✓" : ""}</span>
                <span>
                  <span className="block font-semibold">{m.name}</span>
                  <span className="block text-xs text-muted">{m.blurb}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {SEASONS[season].particles.length > 0 && (
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-foreground/[.04] px-3 py-2 text-sm font-semibold">
          <span>falling {SEASONS[season].name.toLowerCase()} stuff</span>
          <EffectsToggle season={season} />
        </div>
      )}
    </section>
  );
}

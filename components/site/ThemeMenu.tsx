"use client";

import { useEffect, useRef, useState } from "react";
import { SEASONS, SEASON_IDS } from "@/lib/seasons";
import { EffectsToggle } from "./Seasonal";
import { SPECIAL_MODES, setMyTheme, toggleMode, useModes, useMyThemeChoice, useSeason, useSiteSeason } from "./ThemeContext";

/** The menu bar's theme button: pick ur own theme (or follow the site's), moving decorations, and special modes. */
export function ThemeMenu() {
  const season = useSeason();
  const site = useSiteSeason();
  const mine = useMyThemeChoice();
  const modes = useModes();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  const chip = (id: string, icon: string, name: string, on: boolean, pick: () => void) => (
    <button
      key={id}
      type="button"
      onClick={pick}
      aria-pressed={on}
      className={`flex items-center gap-1.5 rounded-xl border px-2 py-1.5 text-left text-xs font-semibold transition-colors ${on ? "border-accent bg-accent/15 ring-2 ring-accent/40" : "border-line hover:bg-accent/10"}`}
    >
      <span className="text-base">{icon}</span>
      <span className="truncate">{name}</span>
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Pick ur theme"
        title="ur theme"
        className="flex h-9 w-9 items-center justify-center rounded-full text-lg transition-[background-color,transform] hover:rotate-12 hover:bg-foreground/[.06]"
      >
        {SEASONS[season].icon === "⚪" ? "🎨" : SEASONS[season].icon}
      </button>
      {open && (
        <div className="jl-pop-in absolute right-0 top-11 z-50 flex max-h-[75vh] w-80 flex-col gap-3 overflow-y-auto rounded-2xl border border-line bg-panel p-4 text-foreground shadow-xl">
          <p className="font-display text-lg font-extrabold">🎨 ur theme</p>
          <div className="grid grid-cols-2 gap-1.5">
            {chip("site", "📅", `the site's (${SEASONS[site].name})`, mine === "site", () => setMyTheme("site"))}
            {SEASON_IDS.map((id) => chip(id, SEASONS[id].icon, SEASONS[id].name, mine === id, () => setMyTheme(id)))}
          </div>
          <div className="flex items-center justify-between rounded-xl bg-foreground/[.04] px-3 py-2 text-sm font-semibold">
            <span>falling stuff</span>
            <EffectsToggle season={season} />
          </div>
          <p className="font-display text-lg font-extrabold">✨ special modes</p>
          <ul className="flex flex-col gap-1">
            {SPECIAL_MODES.map((m) => (
              <li key={m.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-accent/10">
                  <input type="checkbox" checked={modes.includes(m.id)} onChange={() => toggleMode(m.id)} className="h-4 w-4 accent-[var(--accent)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{m.name}</span>
                    <span className="block text-xs text-muted">{m.blurb}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted">this is just for u, on this device. the site&apos;s theme stays the same for evryone else.</p>
        </div>
      )}
    </div>
  );
}

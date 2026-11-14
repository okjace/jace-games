"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SEASONS, SEASON_IDS, type ThemeChoice } from "@/lib/seasons";
import { EffectsToggle } from "./Seasonal";
import { MyThemeChips } from "./MyThemeChips";
import { SPECIAL_MODES, setMyTheme, toggleMode, useModes, useMyThemeChoice, useSeason, useSiteSeason } from "./ThemeContext";

/** The menu bar's theme button: pick ur own theme (or follow the site's), moving decorations, and special modes. */
export function ThemeMenu() {
  const season = useSeason();
  const site = useSiteSeason();
  const mine = useMyThemeChoice();
  const modes = useModes();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  // Admins can switch to setting the theme for everyone (people who left theirs on "the site's").
  const [admin, setAdmin] = useState<{ choice: ThemeChoice; auto: string } | null>(null);
  const [scope, setScope] = useState<"me" | "everyone">("me");
  const [saving, setSaving] = useState<string | null>(null);
  useEffect(() => {
    if (!open || admin) return;
    fetch("/api/site/theme", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.canEdit && setAdmin({ choice: d.choice, auto: d.auto }))
      .catch(() => {});
  }, [open, admin]);
  const setForEveryone = async (choice: ThemeChoice) => {
    setSaving(choice);
    const res = await fetch("/api/site/theme", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ choice }) }).catch(() => null);
    setSaving(null);
    if (res?.ok) {
      setAdmin((a) => (a ? { ...a, choice } : a));
      router.refresh();
    }
  };
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
        {SEASONS[season]?.icon === "⚪" || !SEASONS[season] ? "🎨" : SEASONS[season].icon}
      </button>
      {open && (
        <div className="jl-pop-in absolute right-0 top-11 z-50 flex max-h-[75vh] w-80 flex-col gap-3 overflow-y-auto rounded-2xl border border-line bg-panel p-4 text-foreground shadow-xl">
          {admin && (
            <div className="flex rounded-full border border-line p-1 text-sm font-bold" role="radiogroup" aria-label="Whose theme">
              {(["me", "everyone"] as const).map((sc) => (
                <button
                  key={sc}
                  type="button"
                  role="radio"
                  aria-checked={scope === sc}
                  onClick={() => setScope(sc)}
                  className={`flex-1 rounded-full px-3 py-1 ${scope === sc ? "bg-accent text-on-accent" : "hover:bg-accent/10"}`}
                >
                  {sc === "me" ? "👤 me" : "🌍 everyone"}
                </button>
              ))}
            </div>
          )}
          {scope === "everyone" && admin ? (
            <>
              <p className="font-display text-lg font-extrabold">🌍 theme for evryone</p>
              <p className="-mt-2 text-xs text-muted">evryone who left their theme on &ldquo;the site&apos;s&rdquo; sees this. ppl who picked their own keep theirs.</p>
              <div className="grid grid-cols-2 gap-1.5">
                {chip("auto", saving === "auto" ? "⏳" : "📅", `automatic (${SEASONS[admin.auto as keyof typeof SEASONS]?.name ?? "by date"})`, admin.choice === "auto", () => void setForEveryone("auto"))}
                {SEASON_IDS.map((id) => chip(id, saving === id ? "⏳" : SEASONS[id].icon, SEASONS[id].name, admin.choice === id, () => void setForEveryone(id)))}
              </div>
              {mine !== "site" && <p className="text-xs font-semibold text-warn">heads up: u have ur own theme on, so u wont see this one. switch &ldquo;me&rdquo; to the site&apos;s to see it.</p>}
            </>
          ) : (
            <>
              <p className="font-display text-lg font-extrabold">🎨 ur theme</p>
              <div className="grid grid-cols-2 gap-1.5">
                {chip("site", "📅", `the site's (${SEASONS[site].name})`, mine === "site", () => setMyTheme("site"))}
                {SEASON_IDS.map((id) => chip(id, SEASONS[id].icon, SEASONS[id].name, mine === id, () => setMyTheme(id)))}
                <MyThemeChips compact />
              </div>
            </>
          )}
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

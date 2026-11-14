"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SEASONS, SEASON_IDS, type SeasonId, type ThemeChoice } from "@/lib/seasons";
import { setMyTheme, useMyThemeChoice } from "./ThemeContext";

type State = { choice: ThemeChoice; active: SeasonId; auto: SeasonId; canEdit: boolean };

/**
 * In profile settings: ur own theme first (saved on this device). Admins also
 * get a 🌍 everyone button that sets the site theme, which everyone sees if
 * they left theirs on "the site's". Automatic follows the calendar.
 */
export function SiteThemePicker() {
  const mine = useMyThemeChoice();
  const [scope, setScope] = useState<"me" | "everyone">("me");
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  const [saving, setSaving] = useState<ThemeChoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/site/theme", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setState(d))
      .catch(() => {});
  }, []);
  if (!state) return null;

  const pick = async (choice: ThemeChoice) => {
    setSaving(choice);
    setError(null);
    const res = await fetch("/api/site/theme", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ choice }) }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setSaving(null);
    if (!res?.ok) return setError(body?.error ?? "Couldn't save the theme.");
    setState((s) => (s ? { ...s, choice, active: body.active } : s));
    router.refresh();
  };

  const option = (id: ThemeChoice, icon: string, name: string, note: string) => {
    const on = state.choice === id;
    return (
      <li key={id}>
        <button
          type="button"
          onClick={() => void pick(id)}
          disabled={saving !== null}
          aria-pressed={on}
          className={`flex h-full w-full flex-col items-start gap-0.5 rounded-2xl border p-3 text-left transition-colors disabled:opacity-60 ${
            on ? "border-accent bg-accent/10 ring-2 ring-accent/40" : "border-line bg-panel hover:border-accent/40"
          }`}
        >
          <span className="text-2xl" aria-hidden="true">
            {saving === id ? "⏳" : icon}
          </span>
          <span className="font-semibold">{name}</span>
          <span className="text-xs text-muted">{note}</span>
        </button>
      </li>
    );
  };

  const mineOption = (id: string, icon: string, name: string, note: string) => {
    const on = mine === id;
    return (
      <li key={id}>
        <button
          type="button"
          onClick={() => setMyTheme(id as SeasonId | "site")}
          aria-pressed={on}
          className={`flex h-full w-full flex-col items-start gap-0.5 rounded-2xl border p-3 text-left transition-colors ${on ? "border-accent bg-accent/10 ring-2 ring-accent/40" : "border-line bg-panel hover:border-accent/40"}`}
        >
          <span className="text-2xl" aria-hidden="true">
            {icon}
          </span>
          <span className="font-semibold">{name}</span>
          <span className="text-xs text-muted">{note}</span>
        </button>
      </li>
    );
  };

  return (
    <section className="rounded-3xl border border-line bg-panel p-5 shadow-[0_10px_30px_-18px_rgba(30,20,10,0.25)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold">{scope === "everyone" ? "🌍 theme for evryone" : "🎨 ur theme"}</h2>
        {state.canEdit && (
          <div className="flex rounded-full border border-line p-1 text-sm font-bold" role="radiogroup" aria-label="Whose theme">
            {(["me", "everyone"] as const).map((sc) => (
              <button
                key={sc}
                type="button"
                role="radio"
                aria-checked={scope === sc}
                onClick={() => setScope(sc)}
                className={`rounded-full px-3 py-1 ${scope === sc ? "bg-accent text-on-accent" : "hover:bg-accent/10"}`}
              >
                {sc === "me" ? "👤 me" : "🌍 everyone"}
              </button>
            ))}
          </div>
        )}
      </div>
      {scope === "me" ? (
        <>
          <p className="mb-3 text-xs text-muted">just for u, on this device. pick &ldquo;the site&apos;s&rdquo; to follow whatever evryone else sees.</p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {mineOption("site", "📅", "the site's", `right now: ${SEASONS[state.active].name}`)}
            {SEASON_IDS.map((id) => mineOption(id, SEASONS[id].icon, SEASONS[id].name, id === "plain" ? "no decorations, no extra colour" : SEASONS[id].when))}
          </ul>
        </>
      ) : (
        <>
      <p className="mb-3 text-xs text-muted">
        only admins can change this. evryone who left theirs on &ldquo;the site&apos;s&rdquo; sees it. now showing: <b>{SEASONS[state.active].icon} {SEASONS[state.active].name}</b>
        {mine !== "site" && " (u have ur own theme on, so u wont see this one)"}
      </p>
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {option("auto", "📅", "Automatic", `Follows the calendar (today: ${SEASONS[state.auto].name})`)}
        {SEASON_IDS.map((id) => option(id, SEASONS[id].icon, SEASONS[id].name, id === "plain" ? "No decorations, no extra colour" : SEASONS[id].when))}
      </ul>
        </>
      )}
    </section>
  );
}

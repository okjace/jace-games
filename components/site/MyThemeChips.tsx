"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useScores } from "@/components/ScoresProvider";
import type { ThemeSummary } from "@/lib/customThemes";
import { pickCustomTheme, useMyThemeChoice } from "./ThemeContext";

/** In "ur theme": the themes u made or installed, a + make a theme button, and the market. */
export function MyThemeChips({ compact = false }: { compact?: boolean }) {
  const { user } = useScores();
  const mine = useMyThemeChoice();
  const [themes, setThemes] = useState<ThemeSummary[]>([]);
  useEffect(() => {
    if (!user) return;
    fetch("/api/themes/mine", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { made: [], installed: [] }))
      .then((d) => setThemes([...(d.made ?? []), ...(d.installed ?? [])]))
      .catch(() => {});
  }, [user]);
  const chip = compact
    ? "flex items-center gap-1.5 rounded-xl border px-2 py-1.5 text-left text-xs font-semibold transition-colors"
    : "flex h-full w-full flex-col items-start gap-0.5 rounded-2xl border p-3 text-left text-sm font-semibold transition-colors";
  return (
    <>
      {themes.map((t) => {
        const on = mine === `custom:${t.id}`;
        return (
          <li key={t.id} className={compact ? "contents" : undefined}>
            <button type="button" onClick={() => pickCustomTheme(t)} aria-pressed={on} className={`${chip} ${on ? "border-accent bg-accent/15 ring-2 ring-accent/40" : "border-line hover:bg-accent/10"}`}>
              <span className={compact ? "text-base" : "text-2xl"}>{t.icon}</span>
              <span className="truncate">{t.name}</span>
              {!compact && <span className="text-xs font-normal text-muted">{t.owner_id === user?.id ? "made by u" : `by ${t.owner_name}`}</span>}
            </button>
          </li>
        );
      })}
      <li className={compact ? "contents" : undefined}>
        <Link href={user ? "/themes/new" : "/themes"} className={`${chip} border-dashed border-accent/60 text-accent hover:bg-accent/10`}>
          <span className={compact ? "text-base" : "text-2xl"}>➕</span>
          <span>make a theme</span>
        </Link>
      </li>
      <li className={compact ? "contents" : undefined}>
        <Link href="/themes" className={`${chip} border-line hover:bg-accent/10`}>
          <span className={compact ? "text-base" : "text-2xl"}>🛍️</span>
          <span>theme market</span>
        </Link>
      </li>
    </>
  );
}

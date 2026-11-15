"use client";

import { setLook, useLook, type Look } from "./ThemeContext";

/** ☀️ light / 🌙 dark / 🖥️ auto (saved to ur account when signed in). */
export function LookToggle() {
  const look = useLook();
  const opts: [Look, string][] = [
    ["light", "☀️ light"],
    ["dark", "🌙 dark"],
    ["auto", "🖥️ auto"],
  ];
  return (
    <div className="flex rounded-full border border-line p-1 text-sm font-bold" role="radiogroup" aria-label="Light or dark">
      {opts.map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={look === v}
          onClick={() => setLook(v)}
          className={`flex-1 rounded-full px-3 py-1 ${look === v ? "bg-accent text-on-accent" : "hover:bg-accent/10"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

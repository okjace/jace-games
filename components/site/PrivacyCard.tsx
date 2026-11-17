"use client";

import { pushPrefs } from "./ThemeContext";
import { setAccountOff, useAccountOff } from "./privacy";

/** Profile settings: chat and voice calls off in every game (saved to ur account). */
export function PrivacyCard() {
  const off = useAccountOff();
  const row = (kind: "chat" | "calls", icon: string, name: string, note: string) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl px-2 py-2 hover:bg-accent/10">
      <input type="checkbox" checked={off[kind]} onChange={(e) => setAccountOff(kind, e.target.checked, pushPrefs)} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
      <span>
        <span className="block font-semibold">
          {icon} {name}
        </span>
        <span className="block text-xs text-muted">{note}</span>
      </span>
    </label>
  );
  return (
    <section className="rounded-3xl border border-line bg-panel p-5 shadow-[0_10px_30px_-18px_rgba(30,20,10,0.25)]">
      <h2 className="mb-2 font-display text-xl font-bold">🔒 chat & calls</h2>
      {row("chat", "💬", "no chat in any game", "u wont see or send chat messages anywhere. hosts still can.")}
      {row("calls", "📵", "no voice calls in any game", "the call button never shows for u, even when a host turns calls on.")}
      <p className="mt-1 text-xs text-muted">saved to ur account, so it works on every device. u can also turn them off for just one game in ⚙️ game settings.</p>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { EGGS } from "./MoreEggs";

/** Admins only: a 🥚 button that lists every easter egg (and how to find it) with a button to set it off. */
export function EggMenu() {
  const [admin, setAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  useEffect(() => {
    fetch("/api/site/theme", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAdmin(!!d?.canEdit))
      .catch(() => {});
  }, []);
  if (!admin) return null;
  const shown = EGGS.filter((e) => !q || `${e.name} ${e.how}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fixed bottom-3 right-3 z-[70] flex flex-col items-end gap-2">
      {open && (
        <div className="jl-pop-in flex max-h-[70vh] w-80 flex-col overflow-hidden rounded-3xl border-2 border-line bg-panel shadow-2xl">
          <div className="flex items-center justify-between gap-2 border-b border-line p-3">
            <p className="font-display text-lg font-extrabold">🥚 egg menu (admin)</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close the egg menu" className="text-muted hover:text-foreground">
              ✕
            </button>
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="find an egg…" aria-label="Find an easter egg" className="mx-3 mt-3 h-9 rounded-xl border border-line bg-background/60 px-3 text-sm outline-none focus:border-accent" />
          <ul className="flex flex-col gap-1 overflow-y-auto p-3">
            {shown.map((e) => (
              <li key={e.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-accent/10">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{e.name}</span>
                  <span className="block truncate text-xs text-muted">{e.how}</span>
                </span>
                <button type="button" onClick={() => e.run()} className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-bold text-on-accent hover:scale-105">
                  ▶ run
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Easter egg menu (admin)"
        title="egg menu (admins only)"
        className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-line bg-panel text-2xl shadow-lg transition-transform hover:rotate-12 hover:scale-110"
      >
        🥚
      </button>
    </div>
  );
}

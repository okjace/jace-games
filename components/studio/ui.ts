"use client";

import { useEffect, useState } from "react";

export const card = "rounded-2xl border border-line bg-panel p-6";
export const primary =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-accent px-5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50";
export const secondary =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-line px-5 text-sm font-medium transition-colors hover:bg-foreground/[.05] disabled:opacity-50";
export const small =
  "inline-flex h-8 items-center justify-center gap-1 rounded-full border border-line px-3 text-xs font-medium transition-colors hover:bg-foreground/[.05] disabled:opacity-50";
export const input =
  "h-10 w-full rounded-xl border border-line bg-background px-3 text-sm outline-none transition-colors focus:border-accent";

/** Whether the site is in dark mode, following the theme toggle. */
export function useDarkMode(): boolean {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setDark(el.dataset.theme !== "light");
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

/** fetch() for the studio API: JSON in, JSON out, errors as exceptions with the server's message. */
export async function api<T = Record<string, unknown>>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Something went wrong (${res.status}).`);
  return data as T;
}

"use client";

import { useEffect, useState } from "react";
import { Avatar as PlainAvatar } from "@/components/Avatar";
import { LiveAvatar, LiveName } from "@/components/live/LiveAvatar";
import type { Avatar } from "@/lib/live/locker";

/**
 * People's Locker looks, shown around Jace Games (header, profile,
 * leaderboards, multiplayer). Looks are fetched in batches and cached for
 * the page, so a leaderboard of 50 people is one request. Anyone without a
 * Locker shows the plain avatar.
 */

const cache = new Map<string, Avatar | null>();
const waiting = new Set<string>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  const ids = [...waiting].slice(0, 60);
  ids.forEach((id) => waiting.delete(id));
  if (ids.length === 0) return;
  fetch(`/api/looks?ids=${encodeURIComponent(ids.join(","))}`)
    .then((r) => (r.ok ? r.json() : { looks: {} }))
    .catch(() => ({ looks: {} }))
    .then((d: { looks: Record<string, Avatar> }) => {
      for (const id of ids) cache.set(id, d.looks[id] ?? null);
      listeners.forEach((fn) => fn());
      if (waiting.size) timer = setTimeout(flush, 20);
    });
}

/** Forget a look (after you change yours), so it's fetched again. */
export function refreshLook(userId: string) {
  cache.delete(userId);
  listeners.forEach((fn) => fn());
}

export function useLook(userId: string | null | undefined): Avatar | null {
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  useEffect(() => {
    if (!userId || cache.has(userId) || waiting.has(userId)) return;
    waiting.add(userId);
    timer ??= setTimeout(flush, 20);
  }, [userId]);
  return userId ? (cache.get(userId) ?? null) : null;
}

/** Someone's avatar: their Locker look, or the plain one. `picture` is their Jace picture, if they chose to show it. */
export function UserAvatar({ userId, name, picture, size = 28 }: { userId: string | null | undefined; name: string; picture?: string | null; size?: number }) {
  const look = useLook(userId);
  if (!look) return <PlainAvatar name={name} src={picture} size={size} />;
  return <LiveAvatar avatar={look.icon === "jace" ? { ...look, picture: picture ?? null, icon: picture ? "jace" : "smile" } : look} size={size} />;
}

/** Someone's name with their Locker name color, badge and (optionally) title. */
export function UserName({ userId, name, className = "", title = false }: { userId: string | null | undefined; name: string; className?: string; title?: boolean }) {
  const look = useLook(userId);
  return <LiveName name={name} avatar={look} className={className} title={title} />;
}

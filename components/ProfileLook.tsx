"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LiveAvatar, LiveName } from "@/components/live/LiveAvatar";
import { BADGES, badgeById, type Avatar } from "@/lib/live/locker";
import type { SessionUser } from "@/lib/types";

type Mine = { level: number; xp: number; into: number; need: number; avatar: Avatar; picture: string | null; badges: string[] };

/** On the profile page: your Locker look (it's how you show up across Jace Games), your level and badges. */
export function ProfileLook({ user }: { user: SessionUser }) {
  const [mine, setMine] = useState<Mine | null>(null);
  useEffect(() => {
    fetch("/api/live/locker", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMine(d))
      .catch(() => {});
  }, []);
  const name = user.displayName || user.username;
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-6 sm:flex-row sm:items-center">
      <LiveAvatar avatar={mine ? { ...mine.avatar, picture: mine.picture } : null} size={84} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Your look</p>
        <LiveName name={name} avatar={mine?.avatar} className="text-xl font-bold" />
        {mine ? (
          <>
            <p className="text-sm text-muted">
              Level <b className="text-foreground">{mine.level}</b>
              {mine.level >= 99 ? " · max level!" : ` · ${mine.into}/${mine.need} XP to level ${mine.level + 1}`} · {mine.badges.length}/{BADGES.length} badges
            </p>
            {mine.badges.length > 0 && (
              <p className="flex flex-wrap gap-1 text-xl" aria-label="Your badges">
                {mine.badges.map((b) => (
                  <span key={b} title={badgeById(b)?.name}>
                    {badgeById(b)?.emoji}
                  </span>
                ))}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">Loading…</p>
        )}
        <p className="text-xs text-muted">This is how you show up everywhere on Jace Games: leaderboards, multiplayer and Live.</p>
      </div>
      <Link href="/locker" className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-accent px-5 text-sm font-medium text-on-accent hover:bg-accent-hover">
        🎽 Edit your look
      </Link>
    </section>
  );
}

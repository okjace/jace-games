"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useScores } from "@/components/ScoresProvider";
import { UserAvatar } from "@/components/UserLook";
import type { SeasonId } from "@/lib/seasons";
import { Logo } from "./Logo";
import { EffectsToggle } from "./Seasonal";
import { SoundToggle } from "./SeasonFx";

/** The menu bar: every part of Jace Live. `match` decides which item is lit up. */
const LINKS: { href: string; label: string; icon: string; signedIn?: boolean; match?: (p: string) => boolean }[] = [
  { href: "/", label: "Home", icon: "🏠", match: (p) => p === "/" },
  { href: "/live/host/new", label: "Host", icon: "📺", match: (p) => p.startsWith("/live/host") },
  { href: "/join", label: "Join", icon: "🎮", match: (p) => p === "/join" || p.startsWith("/live/play") || p.startsWith("/live/games") },
  { href: "/live/discover", label: "Discover", icon: "🔎", match: (p) => p.startsWith("/live/discover") },
  { href: "/live/sets", label: "My sets", icon: "📚", match: (p) => p.startsWith("/live/sets") },
  { href: "/live/maps", label: "Maps", icon: "🗺️", match: (p) => p.startsWith("/live/maps") },
  { href: "/live/locker", label: "Locker", icon: "🎽", match: (p) => p.startsWith("/live/locker") || p === "/locker" },
  { href: "/live/reports", label: "Reports", icon: "📋", signedIn: true, match: (p) => p.startsWith("/live/reports") },
  { href: "/studio", label: "Studio", icon: "🧩", match: (p) => p.startsWith("/studio") },
  { href: "/community", label: "Community", icon: "💬", match: (p) => p.startsWith("/community") },
];

export function signInHref(next: string): string {
  return `/api/auth/signin?next=${encodeURIComponent(next)}`;
}

export function SiteHeader({ season }: { season: SeasonId }) {
  const pathname = usePathname();
  const { user } = useScores();
  const links = LINKS.filter((l) => !l.signedIn || user);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-panel/85 shadow-[0_1px_0_rgba(0,0,0,0.02),0_8px_24px_-16px_rgba(0,0,0,0.18)] backdrop-blur-md">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center gap-2 px-3 py-2 sm:gap-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Jace Live home">
          <span data-egg="logo" className="inline-flex">
            <Logo />
          </span>
          <span className="hidden font-display text-xl font-extrabold tracking-tight sm:inline">Jace</span>
          <span data-egg="live" className="rounded-lg bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] px-2 py-0.5 font-display text-sm font-extrabold uppercase tracking-wider text-white shadow-sm">
            Live
          </span>
        </Link>
        <NavRow>
          {links.map((link) => {
            const active = link.match ? link.match(pathname) : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                aria-label={link.label}
                title={link.label}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 font-medium transition-[background-color,transform] hover:-translate-y-0.5 xl:px-3 ${
                  active ? "bg-accent text-on-accent shadow-sm" : "text-muted hover:bg-accent/10 hover:text-foreground"
                }`}
              >
                <span aria-hidden="true" className="text-base leading-none">
                  {link.icon}
                </span>
                {/* Labels when there's room; just icons when it's tight (the page you're on keeps its label). */}
                <span className={active ? "inline" : "hidden xl:inline"}>{link.label}</span>
              </Link>
            );
          })}
        </NavRow>
        <div className="flex shrink-0 items-center gap-1">
          <SoundToggle season={season} />
          <EffectsToggle season={season} />
          {user ? (
            <Link
              href="/profile"
              aria-current={pathname === "/profile" ? "page" : undefined}
              className="flex items-center gap-2 rounded-full border border-line bg-panel py-1 pl-1 pr-1 text-sm font-medium transition-colors hover:bg-accent/10 2xl:pr-3"
            >
              <UserAvatar userId={user.id} name={user.displayName || user.username} picture={user.picture} size={26} />
              <span className="hidden max-w-32 truncate 2xl:inline">{user.displayName || user.username}</span>
            </Link>
          ) : (
            <a
              href={signInHref(pathname)}
              className="flex h-9 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent shadow-sm transition-colors hover:bg-accent-hover"
            >
              Sign in
            </a>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * The menu row. If even the icons don't fit (small phones), it scrolls
 * sideways, with a ◀ or ▶ button only on a side that has more to see.
 */
function NavRow({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [more, setMore] = useState({ left: false, right: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setMore({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", check);
      ro.disconnect();
    };
  }, []);
  const go = (dir: -1 | 1) => ref.current?.scrollBy({ left: dir * Math.max(120, (ref.current?.clientWidth ?? 200) * 0.7), behavior: "smooth" });
  const arrow = "absolute top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-panel text-sm font-bold shadow-md hover:bg-accent hover:text-on-accent";
  return (
    <div className="relative flex min-w-0 flex-1 items-center">
      {more.left && (
        <>
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-10 bg-gradient-to-r from-panel to-transparent" />
          <button type="button" onClick={() => go(-1)} aria-label="More menu to the left" className={`${arrow} left-0`}>
            ◀
          </button>
        </>
      )}
      <nav ref={ref} className="no-scrollbar flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scroll-smooth py-1 text-sm xl:gap-1" aria-label="Jace Live">
        {children}
      </nav>
      {more.right && (
        <>
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-10 bg-gradient-to-l from-panel to-transparent" />
          <button type="button" onClick={() => go(1)} aria-label="More menu to the right" className={`${arrow} right-0`}>
            ▶
          </button>
        </>
      )}
    </div>
  );
}

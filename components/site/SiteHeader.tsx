"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { useScores } from "@/components/ScoresProvider";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const LINKS = [
  { href: "/", label: "Games" },
  { href: "/leaderboards", label: "Leaderboards" },
];

export function signInHref(next: string): string {
  return `/api/auth/signin?next=${encodeURIComponent(next)}`;
}

export function SiteHeader() {
  const pathname = usePathname();
  const { user } = useScores();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-semibold tracking-tight">
            <Logo />
            Games
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {LINKS.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/" || pathname.startsWith("/play/")
                  : pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full px-3 py-1.5 transition-colors ${
                    active
                      ? "bg-foreground/[.08] font-medium text-foreground"
                      : "text-muted hover:bg-foreground/[.05] hover:text-foreground"
                  } ${link.href === "/" ? "hidden sm:inline-block" : ""}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <ThemeToggle />
          {user ? (
            <Link
              href="/profile"
              aria-current={pathname === "/profile" ? "page" : undefined}
              className="flex items-center gap-2 rounded-full border border-line bg-panel py-1 pl-1 pr-1 text-sm font-medium transition-colors hover:bg-foreground/[.05] sm:pr-3"
            >
              <Avatar name={user.username} src={user.picture} size={26} />
              <span className="hidden max-w-32 truncate sm:inline">{user.username}</span>
            </Link>
          ) : (
            <a
              href={signInHref(pathname)}
              className="flex h-9 items-center gap-2 rounded-full bg-accent px-4 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
            >
              <span className="hidden sm:inline">Sign in with Jace</span>
              <span className="sm:hidden">Sign in</span>
            </a>
          )}
        </div>
      </div>
    </header>
  );
}

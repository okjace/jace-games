"use client";

import { useScores } from "@/components/ScoresProvider";
import { signInHref } from "@/components/site/SiteHeader";
import { ProfileLook } from "@/components/ProfileLook";
import { ProfileName } from "@/components/ProfileName";
import { UserAvatar } from "@/components/UserLook";
import { SiteThemePicker } from "@/components/site/SiteThemePicker";
import { SpecialModesCard } from "@/components/site/SpecialModesCard";
import { PrivacyCard } from "@/components/site/PrivacyCard";
import { PublicProfileCard } from "@/components/site/People";

export function ProfileView() {
  const { user } = useScores();

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-3xl border border-line bg-panel p-6 shadow-[0_10px_30px_-18px_rgba(30,20,10,0.25)] sm:flex-row sm:items-center sm:justify-between">
        {user ? (
          <div className="flex items-center gap-4">
            <UserAvatar userId={user.id} name={user.displayName || user.username} picture={user.picture} size={64} />
            <div className="flex flex-col gap-1.5">
              <ProfileName user={user} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-2xl font-extrabold tracking-tight">ur profile</h1>
            <p className="text-sm text-muted">sign in w Jace to keep ur XP, level, look n question sets.</p>
          </div>
        )}
        {user ? (
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="h-10 rounded-full border border-line px-5 text-sm font-medium transition-colors hover:bg-foreground/[.05]"
            >
              Sign out
            </button>
          </form>
        ) : (
          <a
            href={signInHref("/profile")}
            className="inline-flex h-10 items-center justify-center rounded-full bg-accent px-5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
          >
            Sign in w/ Jace
          </a>
        )}
      </section>

      {user && <ProfileLook user={user} />}

      {user && <PublicProfileCard />}
      <SiteThemePicker />
      <SpecialModesCard />
      <PrivacyCard />
    </div>
  );
}

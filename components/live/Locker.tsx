"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useScores } from "@/components/ScoresProvider";
import { signInHref } from "@/components/site/SiteHeader";
import { DEFAULT_AVATAR, FRAMES, ICONS, type Avatar } from "@/lib/live/locker";
import { LiveAvatar, guestAvatar, setGuestAvatar } from "./LiveAvatar";
import { card, primary } from "./ui";

type LockerData = { xp: number; level: number; into: number; need: number; avatar: Avatar; picture: string | null };

/**
 * /live/locker: pick the icon and frame you show in Live games. Signed in,
 * more unlock as you level up (XP comes from finishing games), and you can
 * use your Jace profile picture. Guests can pick from the starter icons.
 */
export function Locker() {
  const { user } = useScores();
  const [data, setData] = useState<LockerData | null>(null);
  const [look, setLook] = useState<Avatar>(DEFAULT_AVATAR);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLook(guestAvatar());
      return;
    }
    fetch("/api/live/locker", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: LockerData | null) => {
        if (!d) return;
        setData(d);
        setLook(d.avatar);
      })
      .catch(() => {});
  }, [user]);

  const level = data?.level ?? 1;
  const choose = async (next: Avatar) => {
    setLook(next);
    if (!user) {
      setGuestAvatar(next);
      setStatus("Saved on this device.");
      return;
    }
    setStatus("Saving…");
    const res = await fetch("/api/live/locker", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ icon: next.icon, frame: next.frame }) }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setStatus(res?.ok ? "Saved. You'll show like this in your next game." : (body?.error ?? "Couldn't save."));
  };

  const tile = (selected: boolean, locked: boolean) =>
    `relative flex flex-col items-center gap-1 rounded-xl border p-2 text-xs transition-colors ${
      selected ? "border-accent bg-accent/10" : locked ? "border-line opacity-45" : "border-line hover:border-accent/50"
    }`;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <Link href="/live" className="text-sm text-muted hover:text-foreground">
          ← Live
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Locker</h1>
        <p className="text-muted">Choose how you show up in Live games.</p>
      </div>

      <section className={`${card} flex flex-wrap items-center gap-5`}>
        <LiveAvatar avatar={look.icon === "jace" ? { ...look, picture: data?.picture } : look} size={88} />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold">{user?.username ?? "Guest"}</p>
          {user && data ? (
            <>
              <p className="text-sm text-muted">
                Level <b className="text-foreground">{data.level}</b> · {data.into}/{data.need} XP to level {data.level + 1}
              </p>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-foreground/10">
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round((data.into / data.need) * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted">Finish Live games (hosted or solo) to earn XP. Right answers and good placings earn more.</p>
            </>
          ) : (
            <p className="text-sm text-muted">
              Guests get the starter icons.{" "}
              <a href={signInHref("/live/locker")} className="text-accent hover:underline">
                Sign in with Jace
              </a>{" "}
              to level up, unlock more, and use your Jace profile picture.
            </p>
          )}
        </div>
      </section>
      {status && <p className="text-sm text-muted" role="status">{status}</p>}

      <section className={card}>
        <h2 className="mb-3 text-sm font-semibold">Icon</h2>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
          {user && (
            <button
              type="button"
              disabled={!data?.picture}
              onClick={() => choose({ ...look, icon: "jace" })}
              aria-pressed={look.icon === "jace"}
              className={tile(look.icon === "jace", !data?.picture)}
              title={data?.picture ? "Your Jace profile picture" : "Add a profile picture on Jace to use it here"}
            >
              <LiveAvatar avatar={{ icon: "jace", frame: "none", picture: data?.picture }} size={40} />
              Jace pic
            </button>
          )}
          {ICONS.map((i) => {
            const locked = i.level > level;
            return (
              <button
                key={i.id}
                type="button"
                disabled={locked}
                onClick={() => choose({ ...look, icon: i.id })}
                aria-pressed={look.icon === i.id}
                aria-label={locked ? `${i.name}, unlocks at level ${i.level}` : i.name}
                className={tile(look.icon === i.id, locked)}
              >
                <span className="text-3xl">{i.emoji}</span>
                {locked ? `🔒 Lv ${i.level}` : i.name}
              </button>
            );
          })}
        </div>
      </section>

      <section className={card}>
        <h2 className="mb-3 text-sm font-semibold">Frame</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-9">
          {FRAMES.map((f) => {
            const locked = f.level > level;
            return (
              <button
                key={f.id}
                type="button"
                disabled={locked}
                onClick={() => choose({ ...look, frame: f.id })}
                aria-pressed={look.frame === f.id}
                aria-label={locked ? `${f.name} frame, unlocks at level ${f.level}` : `${f.name} frame`}
                className={tile(look.frame === f.id, locked)}
              >
                <LiveAvatar avatar={{ ...look, frame: f.id, picture: data?.picture }} size={44} />
                {locked ? `🔒 Lv ${f.level}` : f.name}
              </button>
            );
          })}
        </div>
      </section>

      <Link href="/live" className={`${primary} self-start`}>
        Done
      </Link>
    </div>
  );
}

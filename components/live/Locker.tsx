"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useScores } from "@/components/ScoresProvider";
import { signInHref } from "@/components/site/SiteHeader";
import { DEFAULT_AVATAR, FRAMES, ICONS, TITLES, levelInfo, type Avatar } from "@/lib/live/locker";
import { LiveAvatar, LiveTitle, guestAvatar, setGuestAvatar } from "./LiveAvatar";
import { card, input, primary } from "./ui";

type LockerData = { xp: number; level: number; into: number; need: number; avatar: Avatar; picture: string | null; owner?: boolean };

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
    const res = await fetch("/api/live/locker", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ icon: next.icon, frame: next.frame, title: next.title ?? "" }) }).catch(() => null);
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
          <p className="text-lg font-bold">{user ? user.displayName || user.username : "Guest"}</p>
          <LiveTitle avatar={look} className="text-base" />
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

      <section className={card}>
        <h2 className="mb-1 text-sm font-semibold">Title</h2>
        <p className="mb-3 text-xs text-muted">Shown under your name in games.{!user && " Sign in to unlock titles."}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          {TITLES.map((t) => {
            const locked = !user || t.level > level;
            const selected = (look.title ?? "") === t.id;
            return (
              <button
                key={t.id || "none"}
                type="button"
                disabled={locked && !!t.id}
                onClick={() => choose({ ...look, title: t.id || undefined })}
                aria-pressed={selected}
                aria-label={locked && t.id ? `${t.name} title, unlocks at level ${t.level}` : `${t.name}`}
                className={tile(selected, locked && !!t.id)}
              >
                <span className="text-sm font-black uppercase tracking-wider" style={{ color: t.color || undefined }}>
                  {t.id ? t.name : "—"}
                </span>
                {locked && t.id ? `🔒 Lv ${t.level}` : t.id ? `Lv ${t.level}` : "No title"}
              </button>
            );
          })}
        </div>
      </section>

      {data?.owner && <OwnerXp me={user?.id ?? ""} onMine={(xp) => setData((d) => (d ? { ...d, xp, ...levelInfo(xp) } : d))} />}

      <Link href="/live" className={`${primary} self-start`}>
        Done
      </Link>
    </div>
  );
}

type Person = { userId: string; username: string | null; xp: number; level: number };

/**
 * Site owner only: find anyone with a locker (people who've opened theirs or
 * played Live signed in) and give them XP, or set it exactly. The server
 * checks it's really the owner.
 */
function OwnerXp({ me, onMine }: { me: string; onMine: (xp: number) => void }) {
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Person[] | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/live/admin/xp?q=${encodeURIComponent(q)}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { people: [] }))
        .then((d) => setPeople(d.people ?? []))
        .catch(() => setPeople([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const give = async (p: Person, mode: "add" | "set", amount: number) => {
    setStatus("Saving…");
    const res = await fetch("/api/live/admin/xp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: p.userId, mode, amount }) }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res?.ok) return setStatus(body?.error ?? "Couldn't save.");
    setPeople((list) => (list ?? []).map((x) => (x.userId === p.userId ? { ...x, xp: body.xp, level: body.level } : x)));
    if (p.userId === me) onMine(body.xp);
    setStatus(`${p.username ?? "That player"} now has ${body.xp.toLocaleString()} XP (level ${body.level}).`);
  };

  const MAX_LEVEL_XP = 247_450;
  return (
    <section className={`${card} flex flex-col gap-3 border-amber-500/40`}>
      <div>
        <h2 className="text-sm font-semibold">👑 Give XP (site owner)</h2>
        <p className="text-xs text-muted">Only you see this. People show up here once they&apos;ve opened their locker or played Live signed in.</p>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by username" aria-label="Search by username" className={`${input} h-10`} />
      {status && (
        <p className="text-sm text-muted" role="status">
          {status}
        </p>
      )}
      {people === null ? (
        <p className="animate-pulse text-sm text-muted">Loading…</p>
      ) : people.length === 0 ? (
        <p className="text-sm text-muted">Nobody found.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {people.map((p) => (
            <li key={p.userId} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-2 text-sm">
              <span className="min-w-32 flex-1">
                <b>{p.username ?? "(username not known yet)"}</b>
                {p.userId === me && " (you)"}
                <span className="block text-xs text-muted">
                  Level {p.level} · {p.xp.toLocaleString()} XP
                </span>
              </span>
              <input
                type="number"
                inputMode="numeric"
                value={amounts[p.userId] ?? ""}
                onChange={(e) => setAmounts((a) => ({ ...a, [p.userId]: e.target.value }))}
                placeholder="XP"
                aria-label={`XP for ${p.username ?? "player"}`}
                className="h-9 w-24 rounded-lg border border-line bg-background px-2"
              />
              <button type="button" disabled={!amounts[p.userId]} onClick={() => give(p, "add", Number(amounts[p.userId]))} className="h-9 rounded-full bg-accent px-3 font-semibold text-on-accent disabled:opacity-40">
                + Give
              </button>
              <button type="button" disabled={!amounts[p.userId]} onClick={() => give(p, "set", Number(amounts[p.userId]))} className="h-9 rounded-full border border-line px-3 disabled:opacity-40">
                Set to
              </button>
              <button type="button" onClick={() => give(p, "set", MAX_LEVEL_XP)} className="h-9 rounded-full border border-line px-3">
                Max level
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

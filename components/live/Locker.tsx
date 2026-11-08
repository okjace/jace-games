"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useScores } from "@/components/ScoresProvider";
import { signInHref } from "@/components/site/SiteHeader";
import {
  BADGES,
  CUSTOM_FRAME_LEVEL,
  CUSTOM_STYLES,
  DEFAULT_AVATAR,
  EFFECTS,
  EMPTY_STATS,
  FRAMES,
  FRAME_FX,
  ICONS,
  NAME_COLORS,
  TITLES,
  levelInfo,
  type Avatar,
  type CustomFrame,
  type LiveStats,
} from "@/lib/live/locker";
import { Celebration, LiveAvatar, LiveName, guestAvatar, setGuestAvatar } from "./LiveAvatar";
import { card, input, primary } from "./ui";

type LockerData = {
  xp: number;
  level: number;
  into: number;
  need: number;
  avatar: Avatar;
  picture: string | null;
  stats: LiveStats;
  badges: string[];
  granted: string[];
  owner?: boolean;
};

const DEFAULT_CUSTOM: CustomFrame = { style: "gradient", colors: ["#3ddc84", "#38bdf8"], width: 2 };

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
  const [making, setMaking] = useState(false);
  const [draft, setDraft] = useState<CustomFrame>(DEFAULT_CUSTOM);
  const [celebrate, setCelebrate] = useState(0);

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
    const res = await fetch("/api/live/locker", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        icon: next.icon,
        frame: next.frame,
        custom: next.custom,
        fx: next.fx ?? "",
        title: next.title ?? "",
        nameColor: next.nameColor ?? "",
        effect: next.effect ?? "",
        badge: next.badge ?? "",
      }) }).catch(() => null);
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
          <LiveName name={user ? user.displayName || user.username : "Guest"} avatar={look} className="text-lg font-bold" />
          {user && data ? (
            <>
              <p className="text-sm text-muted">
                Level <b className="text-foreground">{data.level}</b> ·{" "}
                {data.level >= 99 ? `Max level! ${data.xp.toLocaleString()} XP` : `${data.into}/${data.need} XP to level ${data.level + 1}`}
              </p>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-foreground/10">
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${data.level >= 99 ? 100 : Math.round((data.into / data.need) * 100)}%` }} />
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
          <button
            type="button"
            disabled={level < CUSTOM_FRAME_LEVEL}
            onClick={() => {
              setDraft(look.custom ?? DEFAULT_CUSTOM);
              setMaking(true);
            }}
            aria-pressed={look.frame === "custom"}
            aria-label={level < CUSTOM_FRAME_LEVEL ? `Make your own frame, unlocks at level ${CUSTOM_FRAME_LEVEL}` : "Make your own frame"}
            className={tile(look.frame === "custom", level < CUSTOM_FRAME_LEVEL)}
          >
            {look.custom ? <LiveAvatar avatar={{ ...look, frame: "custom", picture: data?.picture }} size={44} /> : <span className="text-3xl">🎨</span>}
            {level < CUSTOM_FRAME_LEVEL ? `🔒 Lv ${CUSTOM_FRAME_LEVEL}` : "Custom"}
          </button>
        </div>
        {making && (
          <FrameMaker
            level={level}
            draft={draft}
            setDraft={setDraft}
            look={{ ...look, picture: data?.picture }}
            onSave={() => {
              setMaking(false);
              void choose({ ...look, frame: "custom", custom: draft });
            }}
            onCancel={() => setMaking(false)}
          />
        )}
      </section>

      <Picker
        title="Frame effect"
        note="How your frame moves."
        items={FRAME_FX}
        level={level}
        signedIn={!!user}
        selected={look.fx ?? ""}
        onPick={(id) => choose({ ...look, fx: id || undefined })}
        render={(f) => <LiveAvatar avatar={{ ...look, fx: f.id, picture: data?.picture }} size={40} />}
      />

      <Picker
        title="Name color"
        note="How your name looks in games."
        items={NAME_COLORS}
        level={level}
        signedIn={!!user}
        selected={look.nameColor ?? ""}
        onPick={(id) => choose({ ...look, nameColor: id || undefined })}
        render={(c) => <LiveName name="Aa" avatar={{ ...DEFAULT_AVATAR, nameColor: c.id }} title={false} className="text-xl font-black" />}
      />

      <Picker
        title="Win celebration"
        note="Rains down on your results screen (and the host's podium) when you win."
        items={EFFECTS}
        level={level}
        signedIn={!!user}
        selected={look.effect ?? ""}
        onPick={(id) => {
          void choose({ ...look, effect: id || undefined });
          if (id) setCelebrate((n) => n + 1);
        }}
        render={(e) => <span className="text-2xl">{e.emojis.slice(0, 2).join("") || "—"}</span>}
      />
      {celebrate > 0 && <Celebration key={celebrate} effect={look.effect} />}

      <Badges stats={data?.stats ?? EMPTY_STATS} earned={data?.badges ?? []} granted={data?.granted ?? []} level={level} signedIn={!!user} selected={look.badge} onPick={(id) => choose({ ...look, badge: id })} />

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

      {data?.owner && (
        <OwnerXp
          me={user?.id ?? ""}
          onMine={(xp) => setData((d) => (d ? { ...d, xp, ...levelInfo(xp) } : d))}
          onBadges={(badges) => setData((d) => (d ? { ...d, badges } : d))}
        />
      )}

      <Link href="/live" className={`${primary} self-start`}>
        Done
      </Link>
    </div>
  );
}

type Person = { userId: string; username: string | null; xp: number; level: number; badges: string[]; granted: string[] };

/**
 * Site owner only: find anyone with a locker (people who've opened theirs or
 * played Live signed in) and give them XP, or set it exactly. The server
 * checks it's really the owner.
 */
function OwnerXp({ me, onMine, onBadges }: { me: string; onMine: (xp: number) => void; onBadges?: (badges: string[]) => void }) {
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

  /** Give or take back a badge (or give them all). */
  const badge = async (p: Person, change: { badge?: string; give?: boolean; all?: boolean }) => {
    setStatus("Saving…");
    const res = await fetch("/api/live/admin/badges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: p.userId, ...change }) }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res?.ok) return setStatus(body?.error ?? "Couldn't save.");
    setPeople((list) => (list ?? []).map((x) => (x.userId === p.userId ? { ...x, badges: body.badges, granted: body.granted } : x)));
    if (p.userId === me) onBadges?.(body.badges);
    const name = p.username ?? "That player";
    setStatus(change.all ? `${name} has every badge now.` : change.give === false ? `Took that badge back from ${name}.` : `Gave ${name} a badge.`);
  };

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
              <div className="flex w-full flex-wrap items-center gap-1 border-t border-line pt-2">
                <span className="mr-1 text-xs text-muted">Badges:</span>
                {BADGES.map((b) => {
                  const has = p.badges.includes(b.id);
                  const given = p.granted.includes(b.id);
                  const earnedByPlaying = has && !given;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      disabled={earnedByPlaying}
                      onClick={() => badge(p, { badge: b.id, give: !given })}
                      aria-pressed={has}
                      title={earnedByPlaying ? `${b.name}: earned by playing` : given ? `${b.name}: given by you (tap to take back)` : `Give ${b.name}`}
                      className={`h-8 w-8 rounded-lg text-lg transition ${has ? "bg-accent/15 ring-1 ring-accent/50" : "opacity-35 grayscale hover:opacity-80 hover:grayscale-0"} ${given ? "ring-amber-400" : ""}`}
                    >
                      {b.emoji}
                    </button>
                  );
                })}
                <button type="button" onClick={() => badge(p, { all: true })} className="ml-1 h-8 rounded-full border border-line px-3 text-xs">
                  All badges
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const tileClass = (selected: boolean, locked: boolean) =>
  `relative flex flex-col items-center gap-1 rounded-xl border p-2 text-xs transition-colors ${
    selected ? "border-accent bg-accent/10" : locked ? "border-line opacity-45" : "border-line hover:border-accent/50"
  }`;

/** A grid of level-locked choices (frame effects, name colors, celebrations). */
function Picker<T extends { id: string; name: string; level: number }>({
  title,
  note,
  items,
  level,
  signedIn,
  selected,
  onPick,
  render,
}: {
  title: string;
  note: string;
  items: T[];
  level: number;
  signedIn: boolean;
  selected: string;
  onPick: (id: string) => void;
  render: (item: T) => React.ReactNode;
}) {
  return (
    <section className={card}>
      <h2 className="mb-1 text-sm font-semibold">{title}</h2>
      <p className="mb-3 text-xs text-muted">
        {note}
        {!signedIn && " Sign in to unlock these."}
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {items.map((it) => {
          const locked = !!it.id && (!signedIn || it.level > level);
          return (
            <button
              key={it.id || "none"}
              type="button"
              disabled={locked}
              onClick={() => onPick(it.id)}
              aria-pressed={selected === it.id}
              aria-label={locked ? `${it.name}, unlocks at level ${it.level}` : it.name}
              className={tileClass(selected === it.id, locked)}
            >
              <span className="flex h-10 items-center">{render(it)}</span>
              {locked ? `🔒 Lv ${it.level}` : it.name}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Make your own frame: a style, your colors, and a thickness, with a live preview. */
function FrameMaker({
  level,
  draft,
  setDraft,
  look,
  onSave,
  onCancel,
}: {
  level: number;
  draft: CustomFrame;
  setDraft: (c: CustomFrame) => void;
  look: Avatar;
  onSave: () => void;
  onCancel: () => void;
}) {
  const style = CUSTOM_STYLES.find((st) => st.id === draft.style) ?? CUSTOM_STYLES[0];
  const [min, max] = style.colors;
  const colors = draft.colors.slice(0, max);
  while (colors.length < min) colors.push(["#facc15", "#ec4899", "#6366f1", "#22c55e"][colors.length]);
  const set = (patch: Partial<CustomFrame>) => setDraft({ ...draft, colors, ...patch });
  return (
    <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-accent/40 bg-accent/[.04] p-4">
      <div className="flex flex-wrap items-center gap-4">
        <LiveAvatar avatar={{ ...look, frame: "custom", custom: { ...draft, colors } }} size={96} />
        <div>
          <p className="font-semibold">🎨 Frame maker</p>
          <p className="text-xs text-muted">Pick a style and your colors. More styles unlock as you level up.</p>
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold">Style</p>
        <div className="flex flex-wrap gap-1.5">
          {CUSTOM_STYLES.map((st) => {
            const locked = st.level > level;
            return (
              <button
                key={st.id}
                type="button"
                disabled={locked}
                aria-pressed={draft.style === st.id}
                onClick={() => set({ style: st.id })}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${draft.style === st.id ? "border-accent bg-accent text-on-accent" : "border-line"} disabled:opacity-40`}
              >
                {locked ? `🔒 ${st.name} (Lv ${st.level})` : st.name}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold">Colors</p>
        <div className="flex flex-wrap items-center gap-2">
          {colors.map((c, i) => (
            <label key={i} className="flex items-center gap-1 rounded-full border border-line py-1 pl-1 pr-2 text-xs">
              <input
                type="color"
                value={c}
                onChange={(e) => set({ colors: colors.map((x, j) => (j === i ? e.target.value : x)) })}
                aria-label={`Color ${i + 1}`}
                className="h-7 w-7 cursor-pointer rounded-full border-0 bg-transparent p-0"
              />
              {i + 1}
              {colors.length > min && (
                <button type="button" aria-label={`Remove color ${i + 1}`} onClick={() => set({ colors: colors.filter((_, j) => j !== i) })} className="ml-1 text-muted hover:text-danger">
                  ✕
                </button>
              )}
            </label>
          ))}
          {colors.length < max && (
            <button type="button" onClick={() => set({ colors: [...colors, "#ffffff"] })} className="rounded-full border border-dashed border-line px-3 py-1.5 text-xs">
              + Add a color
            </button>
          )}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold">Thickness</p>
        <div className="flex gap-1.5">
          {([1, 2, 3] as const).map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={draft.width === w}
              onClick={() => set({ width: w })}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${draft.width === w ? "border-accent bg-accent text-on-accent" : "border-line"}`}
            >
              {["Thin", "Normal", "Thick"][w - 1]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onSave} className="h-10 rounded-full bg-accent px-5 text-sm font-semibold text-on-accent">
          Use this frame
        </button>
        <button type="button" onClick={onCancel} className="h-10 rounded-full px-4 text-sm text-muted hover:text-foreground">
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Badges: earned by doing things in Live. Pick one to show next to your name. */
function Badges({
  stats,
  earned,
  granted,
  level,
  signedIn,
  selected,
  onPick,
}: {
  stats: LiveStats;
  earned: string[];
  granted: string[];
  level: number;
  signedIn: boolean;
  selected: string | undefined;
  onPick: (id: string | undefined) => void;
}) {
  return (
    <section className={card}>
      <h2 className="mb-1 text-sm font-semibold">
        Badges <span className="font-normal text-muted">({earned.length}/{BADGES.length})</span>
      </h2>
      <p className="mb-3 text-xs text-muted">
        Earned by what you do in Live{signedIn ? "" : " (sign in to earn them)"}. Pick one to show next to your name.
        {signedIn && ` So far: ${stats.games} games, ${stats.wins} wins, ${stats.right} right answers, best streak ${stats.bestStreak}.`}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        <button type="button" onClick={() => onPick(undefined)} aria-pressed={!selected} className={tileClass(!selected, false)}>
          <span className="text-2xl">—</span>
          Don&apos;t show one
        </button>
        {BADGES.map((b) => {
          const has = earned.includes(b.id);
          const prog = b.progress?.(stats);
          return (
            <button
              key={b.id}
              type="button"
              disabled={!has}
              onClick={() => onPick(b.id)}
              aria-pressed={selected === b.id}
              title={b.how}
              className={tileClass(selected === b.id, !has)}
            >
              <span className={`text-3xl ${has ? "" : "grayscale"}`}>{b.emoji}</span>
              <span className="font-semibold">{b.name}</span>
              <span className="text-[10px] leading-tight text-muted">{has ? (granted.includes(b.id) && !b.earned(stats, level) ? "Given by the owner" : "Earned!") : b.how}</span>
              {!has && prog && (
                <span className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Math.round((prog[0] / prog[1]) * 100))}%` }} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

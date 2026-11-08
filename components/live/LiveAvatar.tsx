"use client";

import { useEffect, useState } from "react";
import { DEFAULT_AVATAR, badgeById, customRing, effectById, frameById, fxById, iconById, nameColorById, titleById, type Avatar } from "@/lib/live/locker";

/** A player's title (from their locker), as a small colored word. */
export function LiveTitle({ avatar, className = "" }: { avatar: Avatar | null | undefined; className?: string }) {
  const t = avatar?.title ? titleById(avatar.title) : undefined;
  if (!t || !t.id) return null;
  return (
    <span className={`shrink-0 text-[0.7em] font-black uppercase tracking-wider ${className}`} style={{ color: t.color }}>
      {t.name}
    </span>
  );
}

/** A player's name as they styled it: name color, their badge, and their title. */
export function LiveName({ name, avatar, className = "", title = true }: { name: string; avatar: Avatar | null | undefined; className?: string; title?: boolean }) {
  const color = nameColorById(avatar?.nameColor)?.css ?? "";
  const badge = avatar?.badge ? badgeById(avatar.badge) : undefined;
  const style: React.CSSProperties = !color
    ? {}
    : color.startsWith("#")
      ? { color }
      : { backgroundImage: color, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" };
  return (
    <span className={`inline-flex min-w-0 items-center gap-1 ${className}`}>
      <span className="truncate" style={style}>
        {name}
      </span>
      {badge && (
        <span title={badge.name} aria-label={`${badge.name} badge`} className="shrink-0">
          {badge.emoji}
        </span>
      )}
      {title && <LiveTitle avatar={avatar} />}
    </span>
  );
}

/** A player's Live icon (or Jace picture) inside their frame, with its effect. */
export function LiveAvatar({ avatar, size = 32, className = "" }: { avatar: Avatar | null | undefined; size?: number; className?: string }) {
  const a = avatar ?? DEFAULT_AVATAR;
  const ring = a.frame === "custom" && a.custom ? customRing(a.custom) : (frameById(a.frame)?.ring ?? "transparent");
  const widthScale = a.frame === "custom" && a.custom ? [0.6, 1, 1.6][a.custom.width - 1] : 1;
  const pad = ring === "transparent" ? 0 : Math.max(2, Math.round((size / 14) * widthScale));
  const inner = size - pad * 2;
  const fx = fxById(a.fx)?.className ?? "";
  return (
    <span className={`inline-flex shrink-0 rounded-full ${fx} ${className}`} style={{ width: size, height: size, padding: pad, background: ring }} aria-hidden="true">
      {a.icon === "jace" && a.picture ? (
        // Jace pictures can live on any host, so a plain <img>.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.picture} alt="" width={inner} height={inner} referrerPolicy="no-referrer" className="h-full w-full rounded-full bg-white/10 object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-full bg-white/15" style={{ fontSize: inner * 0.6, lineHeight: 1 }}>
          {iconById(a.icon)?.emoji ?? "😀"}
        </span>
      )}
    </span>
  );
}

/** A win celebration: the player's chosen emojis raining down over the screen for a few seconds. */
export function Celebration({ effect }: { effect: string | undefined }) {
  const e = effectById(effect);
  const [drops] = useState(() =>
    Array.from({ length: 36 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 2.2,
      duration: 2.6 + Math.random() * 2,
      size: 18 + Math.random() * 22,
      pick: i,
    })),
  );
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setOn(false), 7000);
    return () => clearTimeout(t);
  }, []);
  if (!e || e.emojis.length === 0 || !on) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden" aria-hidden="true">
      {drops.map((d, i) => (
        <span
          key={i}
          className="jg-rain absolute top-0"
          style={{ left: `${d.left}%`, fontSize: d.size, animation: `jg-rain ${d.duration}s linear ${d.delay}s both` }}
        >
          {e.emojis[d.pick % e.emojis.length]}
        </span>
      ))}
    </div>
  );
}

/** A guest's pick (starter icons only), kept in this browser. */
const GUEST_KEY = "jace-games:live:avatar";
export function guestAvatar(): Avatar {
  try {
    const v = JSON.parse(localStorage.getItem(GUEST_KEY) ?? "null");
    if (v && typeof v.icon === "string" && typeof v.frame === "string") return { icon: v.icon, frame: v.frame };
  } catch {}
  return DEFAULT_AVATAR;
}
export function setGuestAvatar(a: Avatar) {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify({ icon: a.icon, frame: a.frame }));
  } catch {}
}

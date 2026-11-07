import { DEFAULT_AVATAR, frameById, iconById, type Avatar } from "@/lib/live/locker";

/** A player's Live icon (or Jace picture) inside their frame. */
export function LiveAvatar({ avatar, size = 32, className = "" }: { avatar: Avatar | null | undefined; size?: number; className?: string }) {
  const a = avatar ?? DEFAULT_AVATAR;
  const ring = frameById(a.frame)?.ring ?? "transparent";
  const pad = ring === "transparent" ? 0 : Math.max(2, Math.round(size / 14));
  const inner = size - pad * 2;
  return (
    <span className={`inline-flex shrink-0 rounded-full ${className}`} style={{ width: size, height: size, padding: pad, background: ring }} aria-hidden="true">
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

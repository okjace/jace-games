/** A Jace avatar, or the first letter of the username on a tinted circle. */
export function Avatar({ name, src, size = 28 }: { name: string; src?: string | null; size?: number }) {
  if (src) {
    return (
      // Jace avatars can live on any host, so a plain <img> rather than next/image.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className="shrink-0 rounded-full border border-line object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full bg-accent/15 font-semibold text-accent"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

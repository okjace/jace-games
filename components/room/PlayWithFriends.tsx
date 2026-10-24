"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useScores } from "@/components/ScoresProvider";
import { signInHref } from "@/components/site/SiteHeader";
import type { MultiplayerDef } from "@/lib/games";

const MODE_LABEL = { race: "Race your friends", turns: "Play a friend", live: "Play live with friends" };

/** Creates a room for this game and opens its lobby. */
export function PlayWithFriends({ gameId, multiplayer, compact }: { gameId: string; multiplayer: MultiplayerDef; compact?: boolean }) {
  const { user } = useScores();
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const players = multiplayer.min === multiplayer.max ? `${multiplayer.max} players` : `${multiplayer.min}–${multiplayer.max} players`;

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: gameId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't make a room.");
      router.push(`/r/${body.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't make a room.");
      setBusy(false);
    }
  };

  return (
    <div className={compact ? "" : "rounded-2xl border border-accent/40 bg-accent/[.07] p-5"}>
      {!compact && (
        <>
          <p className="text-sm font-semibold">👥 {MODE_LABEL[multiplayer.mode]}</p>
          <p className="mt-1 text-xs text-muted">{players} · invite your Jace Social friends or share a link.</p>
        </>
      )}
      {user ? (
        <button
          type="button"
          onClick={create}
          disabled={busy}
          className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {busy ? "Making a room…" : "Play with friends"}
        </button>
      ) : (
        <a
          href={signInHref(pathname)}
          className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover"
        >
          Sign in to play with friends
        </a>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      <JoinByCode />
    </div>
  );
}

function JoinByCode() {
  const router = useRouter();
  const [code, setCode] = useState("");
  return (
    <form
      className="mt-3 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const c = code.trim().toUpperCase();
        if (/^[A-Z0-9]{4,8}$/.test(c)) router.push(`/r/${c}`);
      }}
    >
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
        placeholder="Have a code?"
        aria-label="Room code"
        className="h-9 min-w-0 flex-1 rounded-full border border-line bg-panel px-3 font-mono text-sm uppercase tracking-widest outline-none focus:border-accent"
      />
      <button type="submit" className="h-9 rounded-full border border-line bg-panel px-4 text-sm font-medium hover:bg-foreground/[.05]">
        Join
      </button>
    </form>
  );
}

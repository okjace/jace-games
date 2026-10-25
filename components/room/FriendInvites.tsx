"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";

type Friend = {
  uuid: string;
  name: string;
  handle: string | null;
  picture: string | null;
  status: "online" | "idle" | "dnd" | "offline";
  activity: string | null;
  canJoin: boolean;
  jaceId: string | null;
};

const STATUS_DOT: Record<Friend["status"], string> = {
  online: "bg-accent",
  idle: "bg-warn",
  dnd: "bg-danger",
  offline: "bg-muted",
};

/**
 * Invite Jace Social friends to this room: the friend gets a DM in Jace
 * Social with the room link. Friends without a Jace account can't sign in
 * to Jace Games, so they're shown but can't be invited.
 */
export function FriendInvites({ code, inRoom }: { code: string; gameName: string; inRoom: string[] }) {
  const [state, setState] = useState<{ kind: "loading" } | { kind: "off" } | { kind: "unlinked" } | { kind: "ready"; friends: Friend[] }>({ kind: "loading" });
  const [sent, setSent] = useState<Record<string, "sending" | "sent" | string>>({});
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/friends", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (!d.available) setState({ kind: "off" });
        else if (!d.linked) setState({ kind: "unlinked" });
        else setState({ kind: "ready", friends: d.friends ?? [] });
      })
      .catch(() => !cancelled && setState({ kind: "off" }));
    return () => {
      cancelled = true;
    };
  }, []);

  const invite = async (f: Friend) => {
    setSent((s) => ({ ...s, [f.uuid]: "sending" }));
    const res = await fetch(`/api/rooms/${code}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: f.uuid }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setSent((s) => ({ ...s, [f.uuid]: res?.ok ? "sent" : (body?.error ?? "Couldn't send.") }));
  };

  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="text-sm font-semibold">Invite Jace Social friends</h2>
      {state.kind === "loading" && <div className="mt-3 h-16 animate-pulse rounded-xl bg-foreground/[.04]" />}
      {state.kind === "off" && <p className="mt-2 text-xs text-muted">Inviting Jace Social friends is coming soon. Share the link for now.</p>}
      {state.kind === "unlinked" && (
        <p className="mt-2 text-xs text-muted">
          Sign in to{" "}
          <a href="https://jace-social.vercel.app" target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
            Jace Social
          </a>{" "}
          with your Jace account once, and your friends will show up here.
        </p>
      )}
      {state.kind === "ready" &&
        (state.friends.length === 0 ? (
          <p className="mt-2 text-xs text-muted">No friends on Jace Social yet.</p>
        ) : (
          <>
            {state.friends.length > 6 && (
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search friends"
                aria-label="Search friends"
                className="mt-3 h-9 w-full rounded-full border border-line bg-background px-3 text-sm outline-none focus:border-accent"
              />
            )}
            <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto">
              {state.friends
                .filter((f) => !filter || `${f.name} ${f.handle ?? ""}`.toLowerCase().includes(filter.toLowerCase()))
                .map((f) => {
                  const here = !!f.jaceId && inRoom.includes(f.jaceId);
                  const s = sent[f.uuid];
                  return (
                    <li key={f.uuid} className={`flex items-center gap-2.5 rounded-xl px-2 py-1.5 ${f.canJoin ? "" : "opacity-50"}`}>
                      <span className="relative">
                        <Avatar name={f.name} src={f.picture} size={30} />
                        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-panel ${STATUS_DOT[f.status]}`} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{f.name}</span>
                        <span className="block truncate text-xs text-muted">
                          {!f.canJoin ? "Needs a Jace account to play" : (f.activity ?? (f.status === "offline" ? "Offline" : "Online"))}
                        </span>
                      </span>
                      {here ? (
                        <span className="text-xs text-accent">In the room</span>
                      ) : (
                        <button
                          type="button"
                          disabled={!f.canJoin || s === "sending" || s === "sent"}
                          onClick={() => invite(f)}
                          title={s && s !== "sending" && s !== "sent" ? s : undefined}
                          className="h-8 shrink-0 rounded-full border border-line px-3 text-xs font-medium transition-colors hover:bg-foreground/[.05] disabled:cursor-default"
                        >
                          {s === "sending" ? "Sending…" : s === "sent" ? "Invited ✓" : s ? "Retry" : "Invite"}
                        </button>
                      )}
                    </li>
                  );
                })}
            </ul>
            {Object.values(sent).find((v) => v !== "sending" && v !== "sent") && (
              <p className="mt-2 text-xs text-danger">{Object.values(sent).find((v) => v !== "sending" && v !== "sent")}</p>
            )}
          </>
        ))}
    </div>
  );
}

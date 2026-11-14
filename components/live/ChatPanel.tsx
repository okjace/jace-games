"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CHAT_MAX, type ChatMessage } from "@/lib/live/chat";
import { openRoomChannel } from "@/lib/realtime/client";

/**
 * Game chat, built into the game page: a column beside the game on wide
 * screens, a box under it on phones. It folds down to one line showing the
 * newest message. New messages arrive through the game's live channel (with
 * a slow poll as a backup). Players send with their key; the host sends with
 * their sign-in, can delete messages and turn chat off.
 *
 * tone "stage" is for the colourful game stages (glass on the stage colour);
 * "panel" matches the site's cards. Give a height with className (the
 * message list fills it while open).
 */
export function ChatPanel({
  code,
  topic,
  token,
  host = false,
  on,
  tone = "panel",
  className = "",
}: {
  code: string;
  topic: string;
  token: string | null;
  host?: boolean;
  on: boolean;
  tone?: "panel" | "stage";
  className?: string;
}) {
  // Open from the start on wide screens (there's room beside the game), folded on phones.
  const [open, setOpen] = useState(() => host || (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [chatOn, setChatOn] = useState(on);
  const openRef = useRef(open);
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const headers = useCallback((): HeadersInit => ({ "Content-Type": "application/json", ...(token ? { "X-Live-Token": token } : {}) }), [token]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/live/games/${code}/chat`, { headers: headers(), cache: "no-store" }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res?.ok || !body) return;
    setChatOn(body.on);
    setMessages((cur) => {
      const fresh = body.messages as ChatMessage[];
      const newOnes = fresh.filter((m) => !cur.some((c) => c.id === m.id)).length;
      if (newOnes && !openRef.current && cur.length) setUnread((n) => n + newOnes);
      return fresh;
    });
  }, [code, headers]);

  useEffect(() => {
    // The first load sets state only after the request returns.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const t = setInterval(() => document.visibilityState === "visible" && void load(), 15_000);
    return () => clearInterval(t);
  }, [load]);

  // Instant delivery through the game's live channel.
  useEffect(() => {
    const ch = openRoomChannel(topic, null);
    const offs = [
      ch.on("chat", (p) => {
        const m = (p as { message?: ChatMessage }).message;
        if (!m) return;
        setMessages((cur) => (cur.some((c) => c.id === m.id) ? cur : [...cur, m].slice(-80)));
        if (!openRef.current) setUnread((n) => n + 1);
      }),
      ch.on("chat-deleted", (p) => {
        const id = (p as { id?: string }).id;
        setMessages((cur) => cur.filter((m) => m.id !== id));
      }),
      ch.on("chat-settings", () => void load()),
    ];
    return () => {
      offs.forEach((off) => off());
      ch.close();
    };
  }, [topic, load]);

  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [open, messages.length]);

  const send = async () => {
    if (!text.trim()) return;
    setError(null);
    const res = await fetch(`/api/live/games/${code}/chat`, { method: "POST", headers: headers(), body: JSON.stringify({ text }) }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res?.ok) return setError(body?.error ?? "Couldn't send.");
    setText("");
    setMessages((cur) => (cur.some((c) => c.id === body.message.id) ? cur.map((c) => (c.id === body.message.id ? { ...c, mine: true } : c)) : [...cur, body.message]));
  };

  const remove = async (id: string) => {
    await fetch(`/api/live/games/${code}/chat?id=${id}`, { method: "DELETE" }).catch(() => null);
    setMessages((cur) => cur.filter((m) => m.id !== id));
  };

  const toggle = async () => {
    const res = await fetch(`/api/live/games/${code}/host`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "chat", on: !chatOn }) }).catch(() => null);
    if (res?.ok) setChatOn(!chatOn);
  };

  if (!chatOn && !host) return null;

  const stage = tone === "stage";
  const last = messages[messages.length - 1];
  const muted = stage ? "text-white/70" : "text-muted";
  const shell = stage ? "border-white/15 bg-black/30 text-white backdrop-blur" : "border-line bg-panel text-foreground";
  const line = stage ? "border-white/15" : "border-line";

  return (
    <section aria-label="Game chat" className={`flex flex-col overflow-hidden rounded-2xl border ${shell} ${open ? className : ""}`}>
      <div className={`flex items-center gap-2 px-3 py-2 ${open ? `border-b ${line}` : ""}`}>
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            setUnread(0);
          }}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="font-semibold">💬 Chat</span>
          {!chatOn && <span className={`text-xs ${muted}`}>(off)</span>}
          {unread > 0 && !open && <span className="rounded-full bg-danger px-1.5 text-xs font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
          {!open && last && (
            <span className={`min-w-0 flex-1 truncate text-sm ${muted}`}>
              <b>{last.name}:</b> {last.text}
            </span>
          )}
        </button>
        {host && open && (
          <button type="button" onClick={() => void toggle()} className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${line}`}>
            {chatOn ? "Turn off" : "Turn on"}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            setUnread(0);
          }}
          aria-label={open ? "Fold chat" : "Open chat"}
          className={`shrink-0 text-sm ${muted} hover:opacity-100`}
        >
          {open ? "▾" : "▸"}
        </button>
      </div>
      {open && (
        <>
          <ol ref={listRef} className="flex min-h-40 flex-1 flex-col gap-1.5 overflow-y-auto p-3 text-sm" aria-live="polite">
            {messages.length === 0 && <li className={`m-auto text-center text-xs ${muted}`}>No messages yet. Say hi! 👋</li>}
            {messages.map((m) => (
              <li key={m.id} className={`group flex flex-col ${m.mine ? "items-end" : "items-start"}`}>
                <span className={`text-[11px] ${muted}`}>
                  {m.host && "👑 "}
                  {m.name}
                </span>
                <span
                  className={`max-w-[85%] break-words rounded-2xl px-3 py-1.5 ${
                    m.mine ? "bg-accent text-on-accent" : m.host ? "bg-amber-500/25" : stage ? "bg-white/15" : "bg-foreground/[.07]"
                  }`}
                >
                  {m.text}
                  {host && (
                    <button type="button" onClick={() => void remove(m.id)} aria-label="Delete message" className="ml-2 text-xs opacity-0 focus:opacity-70 group-hover:opacity-70">
                      🗑️
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ol>
          {chatOn || host ? (
            <form
              className={`flex gap-2 border-t p-2 ${line}`}
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, CHAT_MAX))}
                placeholder={chatOn ? "Say something nice…" : "Chat is off (only you can send)"}
                aria-label="Chat message"
                className={`h-10 min-w-0 flex-1 rounded-full border px-3 text-sm outline-none focus:border-accent ${stage ? "border-white/25 bg-white/10 text-white placeholder:text-white/50" : "border-line bg-background"}`}
              />
              <button type="submit" disabled={!text.trim()} className="h-10 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-50">
                Send
              </button>
            </form>
          ) : (
            <p className={`border-t p-3 text-center text-xs ${line} ${muted}`}>The host turned chat off.</p>
          )}
          {error && <p className="px-3 pb-2 text-xs text-danger">{error}</p>}
        </>
      )}
    </section>
  );
}

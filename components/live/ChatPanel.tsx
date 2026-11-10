"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CHAT_MAX, type ChatMessage } from "@/lib/live/chat";
import { openRoomChannel } from "@/lib/realtime/client";

/**
 * Game chat: a 💬 button in the corner that opens a small chat panel.
 * New messages arrive through the game's live channel (with a slow poll as
 * a backup). Players send with their key; the host sends with their
 * sign-in, can delete messages and turn chat off.
 */
export function ChatPanel({ code, topic, token, host = false, on }: { code: string; topic: string; token: string | null; host?: boolean; on: boolean }) {
  const [open, setOpen] = useState(false);
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

  if (!chatOn && !host && !open) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[75] flex flex-col items-end gap-2">
      {open && (
        <div className="flex h-[26rem] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-panel text-foreground shadow-2xl">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <p className="font-semibold">💬 Game chat</p>
            <div className="flex items-center gap-2">
              {host && (
                <button type="button" onClick={() => void toggle()} className="rounded-full border border-line px-2 py-0.5 text-xs">
                  {chatOn ? "Turn chat off" : "Turn chat on"}
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="text-muted hover:text-foreground">
                ✕
              </button>
            </div>
          </div>
          <ol ref={listRef} className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-3 text-sm" aria-live="polite">
            {messages.length === 0 && <li className="m-auto text-center text-xs text-muted">No messages yet. Say hi! 👋</li>}
            {messages.map((m) => (
              <li key={m.id} className={`group flex flex-col ${m.mine ? "items-end" : "items-start"}`}>
                <span className="text-[11px] text-muted">
                  {m.host && "👑 "}
                  {m.name}
                </span>
                <span className={`max-w-[85%] break-words rounded-2xl px-3 py-1.5 ${m.mine ? "bg-accent text-on-accent" : m.host ? "bg-amber-500/20" : "bg-foreground/[.07]"}`}>
                  {m.text}
                  {host && (
                    <button type="button" onClick={() => void remove(m.id)} aria-label="Delete message" className="ml-2 text-xs opacity-0 group-hover:opacity-70">
                      🗑️
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ol>
          {chatOn || host ? (
            <form
              className="flex gap-2 border-t border-line p-2"
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
                className="h-10 min-w-0 flex-1 rounded-full border border-line bg-background px-3 text-sm outline-none focus:border-accent"
              />
              <button type="submit" disabled={!text.trim()} className="h-10 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-50">
                Send
              </button>
            </form>
          ) : (
            <p className="border-t border-line p-3 text-center text-xs text-muted">The host turned chat off.</p>
          )}
          {error && <p className="px-3 pb-2 text-xs text-danger">{error}</p>}
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setUnread(0);
        }}
        aria-label={open ? "Close chat" : `Open chat${unread ? ` (${unread} new)` : ""}`}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-on-accent shadow-xl hover:bg-accent-hover"
      >
        💬
        {unread > 0 && !open && <span className="absolute -right-1 -top-1 rounded-full bg-danger px-1.5 text-xs font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
    </div>
  );
}

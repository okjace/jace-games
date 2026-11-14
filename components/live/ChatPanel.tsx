"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CHAT_MAX, type ChatMessage } from "@/lib/live/chat";
import { openRoomChannel } from "@/lib/realtime/client";

/**
 * Whether the game chat is shown (remembered on this device, like the sound
 * button) and how many messages came in while it was hidden. Shared by the
 * chat panel and its 💬 button.
 */
const CHAT_KEY = "jace-games:live:chat-hidden";
type ChatUi = { shown: boolean; unread: number };
const SERVER_UI: ChatUi = { shown: false, unread: 0 };
let ui: ChatUi | null = null;
const uiSubs = new Set<() => void>();

function readUi(): ChatUi {
  if (!ui) {
    // Hidden until you open it (then remembered on this device).
    let shown = false;
    try {
      shown = localStorage.getItem(CHAT_KEY) === "0";
    } catch {}
    ui = { shown, unread: 0 };
  }
  return ui;
}

function setUi(patch: Partial<ChatUi>) {
  ui = { ...readUi(), ...patch };
  if (patch.shown !== undefined) {
    try {
      localStorage.setItem(CHAT_KEY, patch.shown ? "0" : "1");
    } catch {}
  }
  uiSubs.forEach((fn) => fn());
}

function useChatUi(): ChatUi {
  return useSyncExternalStore(
    (fn) => {
      uiSubs.add(fn);
      return () => void uiSubs.delete(fn);
    },
    readUi,
    () => SERVER_UI,
  );
}

/** Whether the chat is showing, so a page can give the game the full width while it's hidden. */
export function useChatShown(): boolean {
  return useChatUi().shown;
}

/** Shows or hides the game chat, like the sound button. Shows how many messages you missed while it was hidden. */
export function ChatButton({ className = "", label = false }: { className?: string; label?: boolean }) {
  const { shown, unread } = useChatUi();
  return (
    <button
      type="button"
      aria-pressed={shown}
      onClick={() => setUi({ shown: !shown, unread: 0 })}
      aria-label={shown ? "Hide chat" : `Show chat${unread ? ` (${unread} new)` : ""}`}
      title={shown ? "Hide chat" : "Show chat"}
      className={`relative ${className}`}
    >
      <span className={shown ? "" : "opacity-60"}>💬</span>
      {label && <span className="ml-1">{shown ? "Hide chat" : "Chat"}</span>}
      {!shown && unread > 0 && (
        <span className="absolute -right-1.5 -top-1.5 rounded-full bg-danger px-1.5 text-[10px] font-bold leading-4 text-white">{unread > 9 ? "9+" : unread}</span>
      )}
    </button>
  );
}

/**
 * Game chat, built into the game page: a column beside the game on wide
 * screens, a box under it on phones; ChatButton shows or hides it. New messages arrive through the game's live channel (with
 * a slow poll as a backup). Players send with their key; the host sends with
 * their sign-in, can delete messages and turn chat off.
 *
 * tone "stage" is for the colourful game stages (glass on the stage colour);
 * "panel" matches the site's cards. Give a height with className (the
 * message list fills it).
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
  const { shown } = useChatUi();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [chatOn, setChatOn] = useState(on);
  const shownRef = useRef(shown);
  const seen = useRef<Set<string> | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    shownRef.current = shown;
  }, [shown]);

  // Count messages that arrive while the chat is hidden (not the ones already there).
  const arrived = useCallback((ids: string[]) => {
    if (!seen.current) {
      seen.current = new Set(ids);
      return;
    }
    const fresh = ids.filter((id) => !seen.current!.has(id));
    fresh.forEach((id) => seen.current!.add(id));
    if (fresh.length && !shownRef.current) setUi({ unread: readUi().unread + fresh.length });
  }, []);

  const headers = useCallback((): HeadersInit => ({ "Content-Type": "application/json", ...(token ? { "X-Live-Token": token } : {}) }), [token]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/live/games/${code}/chat`, { headers: headers(), cache: "no-store" }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res?.ok || !body) return;
    setChatOn(body.on);
    const fresh = body.messages as ChatMessage[];
    arrived(fresh.map((m) => m.id));
    setMessages(fresh);
  }, [code, headers, arrived]);

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
        arrived([m.id]);
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
  }, [topic, load, arrived]);

  useEffect(() => {
    if (shown) listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [shown, messages.length]);

  const send = async () => {
    if (!text.trim()) return;
    setError(null);
    const res = await fetch(`/api/live/games/${code}/chat`, { method: "POST", headers: headers(), body: JSON.stringify({ text }) }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res?.ok) return setError(body?.error ?? "Couldn't send.");
    setText("");
    seen.current?.add(body.message.id);
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

  if ((!chatOn && !host) || !shown) return null;

  const stage = tone === "stage";
  const muted = stage ? "text-white/70" : "text-muted";
  const shell = stage ? "border-white/15 bg-black/30 text-white backdrop-blur" : "border-line bg-panel text-foreground";
  const line = stage ? "border-white/15" : "border-line";

  return (
    <section aria-label="Game chat" className={`flex flex-col overflow-hidden rounded-2xl border ${shell} ${className}`}>
      <div className={`flex items-center gap-2 border-b px-3 py-2 ${line}`}>
        <p className="flex-1 font-semibold">
          💬 Chat {!chatOn && <span className={`text-xs font-normal ${muted}`}>(off for players)</span>}
        </p>
        {host && (
          <button type="button" onClick={() => void toggle()} className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${line}`}>
            {chatOn ? "Turn off for players" : "Turn on for players"}
          </button>
        )}
        <button type="button" onClick={() => setUi({ shown: false, unread: 0 })} aria-label="Hide chat" title="Hide chat" className={`shrink-0 ${muted} hover:opacity-100`}>
          ✕
        </button>
      </div>
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
    </section>
  );
}
